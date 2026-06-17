const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { getVpnStatus } = require('@librechat/api');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    res.status(200).json(await getVpnStatus());
  } catch (error) {
    logger.error('[vpnStatus] Error getting VPN status', error);
    res.status(500).json({ message: 'Error getting VPN status' });
  }
});

module.exports = router;
