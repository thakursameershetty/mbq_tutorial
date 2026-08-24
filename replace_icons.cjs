const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

const files = [
    'public/templates/caffeine-sample.html',
    'public/templates/muscle-sample.html',
    'public/templates/hair-sample.html'
];

const keywordToIcon = {
    'Focus': 'neurology',
    'Sleep': 'bedtime',
    'Energy': 'local_cafe',
    'Strength': 'exercise',
    'Speed': 'speed',
    'Stamina': 'ecg_heart',
    'Recovery': 'self_care',
    'Density': 'scatter_plot', // using scatter_plot as fallback for density
    'Thickness': 'line_weight',
    'Growth': 'trending_up',
    'Metabolism': 'bolt_boost',
    'L-Theanine': 'pill',
    'Eat Before Coffee': 'set_meal',
    'Water': 'water_full',
    'Manage Stress': 'spa',
    'Faster Clearance': 'directions_walk',
    'Sustained Energy': 'bolt_boost',
    'Lower Anxiety': 'person',
    'Sleep Impact': 'bedtime',
    'Actionable Insights': 'lightbulb',
    'Scientific References': 'auto_stories'
};

function determineIcon(text, defaultIcon) {
    if (!text) return defaultIcon;
    text = text.toLowerCase();
    for (const [key, icon] of Object.entries(keywordToIcon)) {
        if (text.includes(key.toLowerCase())) {
            return icon;
        }
    }
    return defaultIcon;
}

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;
    
    console.log(`Processing ${file}...`);
    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('svg').each((i, el) => {
        const $svg = $(el);
        
        // Skip svgs inside the summary scores (like the gauge arcs)
        // Check if it's a large structural SVG (e.g., width="128")
        const width = $svg.attr('width');
        if (width && parseInt(width) > 50) return;
        
        // Find text near the SVG
        const parentText = $svg.parent().parent().text();
        const iconName = determineIcon(parentText, 'verified');
        
        // Extract color from stroke or fill
        let color = $svg.attr('stroke') || $svg.attr('fill') || 'currentColor';
        if (color === 'none') {
            color = $svg.find('path, circle').first().attr('stroke') || $svg.find('path, circle').first().attr('fill') || '#ef7d22';
        }
        if (color === 'none') color = '#ef7d22'; // fallback
        
        const size = width || '24';
        
        // Create the placeholder
        const placeholder = `<div class="dynamic-icon" data-icon="${iconName}" data-color="${color}" data-size="${size}" style="display:inline-block; width:${size}px; height:${size}px;"></div>`;
        
        $svg.replaceWith(placeholder);
    });

    // Write back
    // Use .html() but unescape the wrappers added by cheerio
    // Cheerio adds html, head, body tags if loading full document
    // Let's just output the body innerHTML, wait, these templates have <div> as root usually?
    // Actually, Cheerio preserves the root structure.
    let output = $.html();
    // Some minor cleanup if Cheerio injected html/head/body
    if (output.includes('<html><head></head><body>')) {
        output = output.replace('<html><head></head><body>', '').replace('</body></html>', '');
    }
    
    fs.writeFileSync(filePath, output, 'utf8');
    console.log(`Updated ${file}.`);
});
