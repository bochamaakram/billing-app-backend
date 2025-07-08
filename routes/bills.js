const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const Bill = require('../models/Bill');

// @route   POST /bills
// @desc    Add a new bill
router.post('/', auth, async (req, res) => {
  try {
    const { description, amount } = req.body;
    const newBill = new Bill({
      user: req.user.id,
      description,
      amount
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

module.exports = router;