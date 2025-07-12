const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const Bill = require('../models/Bill');

// @route   POST /bills
// @desc    Add a new bill
router.post('/', auth, async (req, res) => {
  try {
    const { customerName, customerPhone, customerEmail, items } = req.body;

    const newBill = new Bill({
      user: req.user.id,
      customerName,
      customerPhone,
      customerEmail,
      items
    });

    const bill = await newBill.save();
    res.json(bill);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET /bills
// @desc    Get all bills for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const bills = await Bill.find({ user: req.user.id }).sort({ date: -1 });
    res.json(bills);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});
// @route   DELETE /bills/:id
// @desc    Delete a bill by ID
router.delete('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });

    if (!bill) {
      return res.status(404).json({ msg: 'Bill not found' });
    }

    await bill.deleteOne();
    res.json({ msg: 'Bill deleted successfully' });
  } catch (err) {
    console.error(err.message);

    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid bill ID' });
    }

    res.status(500).send('Server error');
  }
});

// @route   GET /bills/:id
// @desc    Get a single bill by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const bill = await Bill.findOne({ _id: req.params.id, user: req.user.id });

    if (!bill) {
      return res.status(404).json({ msg: 'Bill not found' });
    }

    res.json(bill);
  } catch (err) {
    console.error(err.message);

    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid bill ID' });
    }

    res.status(500).send('Server error');
  }
});

module.exports = router;
