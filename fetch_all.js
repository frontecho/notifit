const fetchNews = require('./zjufetch.js');

let fetchSources = {
    'zdbk': true,
    'ugrs': true,
    'bksy': true,
    'youth': true,
    'zhfw': true,
    'libweb': true,
    'ckcoffice': true,
    'qsxy': true,
    'zjutw': true,
    'wxpub_zjdx': false,
    'wxpub_zdwxg': false,
    'wxpub_zjdxtw': false,
    'wxpub_zjdxxsh': false,
    'wxpub_zdtyyys': false,
    'wxpub_zdhq': false,
    'wxpub_zdxsgyglfwzx': false,
    'wxpub_zdzjgurha': false,
    'wxpub_zjdxyy': false,
    'wxpub_zjdxsh': false,
    'wxpub_zdqs': false,
    'wxpub_zdqz': false,
    'wxpub_zdstzjust': false,
    'wxpub_zdstzdzx': false,
    'wxpub_zjdxqsxy': false,
    'wxpub_zdzyr': false,
    'wxpub_zytxh': false
};

// fetchNews("./source_config.json", fetchSources);
fetchNews("./source_config.json", fetchSources, true);

// const config = JSON.parse(fs.readFileSync("./source_config.json"));
// for (const key in config) {
//     if (config.hasOwnProperty(key)) {
//         fetchSourcesArray.push(key);
//     }
//     console.log(`'${key}',\n`);
// }

// console.log(fetchSourcesArray);