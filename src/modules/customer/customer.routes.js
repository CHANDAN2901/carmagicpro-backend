const { Router } = require('express');
const { customerAuthenticate } = require('../../middleware/customerAuth');
const ctrl = require('./customer.controller');

const router = Router();

router.use(customerAuthenticate);

router.get('/me', ctrl.getProfile);
router.patch('/me', ctrl.updateProfile);
router.get('/bookings', ctrl.getMyBookings);
router.post('/bookings', ctrl.createBooking);
router.get('/orders', ctrl.getMyOrders);
router.post('/orders', ctrl.createOrder);
router.get('/vehicles', ctrl.getMyVehicles);
router.post('/vehicles', ctrl.addVehicle);
router.delete('/vehicles/:id', ctrl.deleteVehicle);

module.exports = router;
