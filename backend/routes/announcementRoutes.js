
/*
=========================================
 MEMORA CREATIONS
 WEBSITE ANNOUNCEMENT API

 PUBLIC:
 GET /api/announcement

 ADMIN:
 GET /api/announcement/manage
 PUT /api/announcement/manage
=========================================
*/

const router = require('express').Router();

const SiteAnnouncement = require(
  '../models/SiteAnnouncement'
);

const {
  requireAdmin
} = require('../middleware/auth');


/* =====================================
   DEFAULT ANNOUNCEMENT
===================================== */

const DEFAULT_ANNOUNCEMENT = {
  enabled: false,
  title: '',
  message: '',
  updatedAt: null
};


/* =====================================
   PUBLIC ANNOUNCEMENT
===================================== */

router.get(
  '/',
  async (_req, res) => {
    try {
      const announcement =
        await SiteAnnouncement.findOne({
          key: 'homepage'
        }).lean();

      res.set(
        'Cache-Control',
        'no-store'
      );

      if (
        !announcement ||
        !announcement.enabled
      ) {
        return res.json({
          success: true,
          announcement:
            DEFAULT_ANNOUNCEMENT
        });
      }

      return res.json({
        success: true,
        announcement: {
          enabled: true,
          title: announcement.title,
          message: announcement.message,
          updatedAt:
            announcement.updatedAt
        }
      });

    } catch (error) {
      console.error(
        'Public announcement error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Announcement unavailable.'
      });
    }
  }
);


/* =====================================
   ADMIN - GET ANNOUNCEMENT
===================================== */

router.get(
  '/manage',
  requireAdmin,
  async (_req, res) => {
    try {
      const announcement =
        await SiteAnnouncement.findOne({
          key: 'homepage'
        }).lean();

      res.set(
        'Cache-Control',
        'no-store'
      );

      return res.json({
        success: true,
        announcement:
          announcement
            ? {
                enabled:
                  Boolean(
                    announcement.enabled
                  ),
                title:
                  announcement.title,
                message:
                  announcement.message,
                updatedAt:
                  announcement.updatedAt
              }
            : DEFAULT_ANNOUNCEMENT
      });

    } catch (error) {
      console.error(
        'Admin announcement error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Announcement could not be loaded.'
      });
    }
  }
);


/* =====================================
   ADMIN - UPDATE ANNOUNCEMENT
===================================== */

router.put(
  '/manage',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        enabled,
        title,
        message
      } = req.body || {};

      if (
        typeof enabled !== 'boolean' ||
        typeof title !== 'string' ||
        typeof message !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid announcement data.'
        });
      }

      const cleanTitle = title.trim();
      const cleanMessage = message.trim();

      if (
        cleanTitle.length > 120 ||
        cleanMessage.length > 1000
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Title or message is too long.'
        });
      }

      if (
        enabled &&
        (
          !cleanTitle ||
          !cleanMessage
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Title and message are required when popup is ON.'
        });
      }

      const announcement =
        await SiteAnnouncement.findOneAndUpdate(
          {
            key: 'homepage'
          },
          {
            $set: {
              enabled,
              title: cleanTitle,
              message: cleanMessage,
              updatedAt: new Date()
            }
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
          }
        ).lean();

      res.set(
        'Cache-Control',
        'no-store'
      );

      return res.json({
        success: true,
        message:
          'Announcement saved successfully.',
        announcement: {
          enabled:
            Boolean(
              announcement.enabled
            ),
          title:
            announcement.title,
          message:
            announcement.message,
          updatedAt:
            announcement.updatedAt
        }
      });

    } catch (error) {
      console.error(
        'Announcement update error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Could not save announcement.'
      });
    }
  }
);


module.exports = router;
