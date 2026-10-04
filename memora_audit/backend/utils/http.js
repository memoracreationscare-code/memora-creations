function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function error(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

module.exports = { asyncHandler, error, ok };
