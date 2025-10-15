const info = (...args) => console.log('[INFO]', ...args);
const error = (...args) => console.error('[ERROR]', ...args);
module.exports = { info, error };