require('dotenv').config();
const { generatePhenotypicAnalysis } = require('./aiMapping.js');
const rawData = { "3. Physical sensitivity &amp; inhibitor context": "Calm or normal", "Any specific remarks": "Test remarks" };
generatePhenotypicAnalysis(rawData).then(res => console.log(JSON.stringify(res, null, 2))).catch(console.error);
