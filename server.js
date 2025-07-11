require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// User Schema & Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Bill Schema & Model
const billSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  customerEmail: { type: String, required: true },
  items: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: {
    type: Number,
    default: 0
  },
  date: { type: Date, default: Date.now }
});

billSchema.pre('save', function (next) {
  this.totalAmount = this.items.reduce((total, item) => total + item.quantity * item.price, 0);
  next();
});

const Bill = mongoose.model('Bill', billSchema);

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new Error();

    req.user = user;
    next();
  } catch (err) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.send('Billing App API');
});

// Auth Routes
app.post('/auth/register', [
  body('name', 'Name is required').notEmpty(),
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password must be 6+ characters').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });

    user = new User({ name, email, password });
    await user.save();

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/auth/login', [
  body('email', 'Please include a valid email').isEmail(),
  body('password', 'Password is required').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bill Routes
app.post('/bills', auth, async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, items } = req.body;
    const bill = new Bill({
      user: req.user.id,
      customerName,
      customerPhone,
      customerEmail,
      items
    });
    await bill.save();
    res.status(201).json(bill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/bills', auth, async (req, res) => {
  try {
    const bills = await Bill.find({ user: req.user.id }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/bills/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
    if (!bill) return res.status(404).json({ msg: 'Bill not found' });
    res.json(bill);
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') return res.status(400).json({ msg: 'Invalid bill ID' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/bills/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    // Replace remove() with deleteOne()
    await Bill.deleteOne({ _id: req.params.id });
    res.json({ message: 'Bill deleted successfully' });
  } catch (err) {
    console.error(err);
    if (err.kind === 'ObjectId') return res.status(400).json({ error: 'Invalid bill ID' });
    res.status(500).json({ error: 'Server error' });
  }
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
