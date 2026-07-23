const fs = require('fs');
const cheerio = require('cheerio');

const files = ['public/templates/caffeine-sample.html', 'public/templates/hair-sample.html', 'public/safe-muscle-sample.html'];

function processFile(file) {
    if (!fs.existsSync(file)) file = file.replace('safe-', ''); // fallback if safe- doesn't exist
    if (!fs.existsSync(file)) return;
    
    const html = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(html, { recognizeSelfClose: true, decodeEntities: false });

    // 1. Domain overview (the very first <p> after the header)
    // It's usually the first paragraph that is not empty
    $('p').each((i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (text.includes("your genetics indicate") || text.includes("processes caffeine") || text.includes("your hair") || text.includes("muscle") || text.includes("cyp1a2") || i === 0) {
            if (!$(el).attr('id') && text.length > 20) {
                 // The first long paragraph is our domain overview
                 $(el).attr('id', 'domain-overview');
                 return false; // break loop
            }
        }
    });

    // 2. What this means
    let pTags = $('p').toArray();
    let whatThisMeansIdx = pTags.findIndex(el => $(el).text().trim().toUpperCase() === "WHAT THIS MEANS");
    if (whatThisMeansIdx > -1) {
        // The bullet points are the next 4 paragraphs or list items
        let count = 0;
        for (let i = whatThisMeansIdx + 1; i < pTags.length; i++) {
            const el = pTags[i];
            const t = $(el).text().trim();
            if (t.length > 0 && t.length < 80) { // likely a bullet
                count++;
                $(el).attr('id', 'what-this-means-' + count);
                if (count === 4) break;
            }
        }
    }

    // 3. What you may notice
    let whatYouNoticeIdx = pTags.findIndex(el => $(el).text().trim().toUpperCase() === "WHAT YOU MAY NOTICE");
    if (whatYouNoticeIdx > -1) {
        let count = 0;
        for (let i = whatYouNoticeIdx + 1; i < pTags.length; i++) {
            const el = pTags[i];
            const t = $(el).text().trim();
            if (t.length > 0 && t.length < 80) { 
                count++;
                $(el).attr('id', 'what-you-may-notice-' + count);
                if (count === 4) break;
            }
        }
    }

    // 4. What this explains
    let whatExplainsIdx = pTags.findIndex(el => $(el).text().trim().toUpperCase() === "WHAT THIS EXPLAINS");
    if (whatExplainsIdx > -1) {
        let count = 0;
        for (let i = whatExplainsIdx + 1; i < pTags.length; i++) {
            const el = pTags[i];
            const t = $(el).text().trim();
            if (t.length > 0 && t.length < 80) { 
                count++;
                $(el).attr('id', 'what-this-explains-' + count);
                if (count === 4) break;
            }
        }
    }

    // 5. Science behind it
    let scienceIdx = pTags.findIndex(el => $(el).text().trim().toUpperCase() === "THE SCIENCE BEHIND IT");
    if (scienceIdx > -1) {
        let count = 0;
        for (let i = scienceIdx + 1; i < pTags.length; i++) {
            const el = pTags[i];
            const t = $(el).text().trim();
            if (t.length > 80 && count < 2) { // Long paragraphs
                count++;
                $(el).attr('id', 'science-paragraph-' + count);
                if (count === 2) break;
            }
        }
    }

    // 6. Key Takeaway
    let takeawayIdx = pTags.findIndex(el => $(el).text().trim().toUpperCase() === "KEY TAKEAWAY");
    if (takeawayIdx > -1) {
        for (let i = takeawayIdx + 1; i < pTags.length; i++) {
            const el = pTags[i];
            const t = $(el).text().trim();
            if (t.length > 10) { 
                $(el).attr('id', 'key-takeaway');
                break;
            }
        }
    }
    
    fs.writeFileSync(file, $.html());
    console.log("Processed " + file);
}

files.forEach(processFile);
