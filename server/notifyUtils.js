const sanitizeForTemplate = (str) => String(str || '')
  .replace(/[\r\n\t]+/g, ' ')
  .replace(/ {2,}/g, ' ')
  .trim();

const buildNameWithTests = (firstName, testNames) => {
  const cleanName = sanitizeForTemplate(firstName) || 'User';
  const cleanTests = (Array.isArray(testNames) ? testNames : [testNames])
    .map(sanitizeForTemplate)
    .filter(Boolean);
  const testsStr = cleanTests.length ? cleanTests.join(', ') : 'Test';
  return sanitizeForTemplate(`${cleanName} (${testsStr})`);
};

const firstNameOf = (user) => (user && user.full_name)
  ? String(user.full_name).split(' ')[0]
  : (user && user.username ? String(user.username) : 'User');

module.exports = { sanitizeForTemplate, buildNameWithTests, firstNameOf };
