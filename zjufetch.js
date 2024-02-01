const fs = require('fs');
const fetch = require('node-fetch');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

class NewsFetcher {
    constructor(config, timestamp) {
        this.allNews = [];
        this.numberCounter = 0;

        this.earliestDateTime = config.earliestDateTime || 'all';
        this.maxNumber = config.maxNumber || 100;
        this.baseUrl = config.baseUrl || '';
        this.urlTemplate = this.baseUrl + (config.urlTemplate || '');
        this.linkTemplate = this.baseUrl + (config.linkTemplate || '');
        this.nickName = config.nickName || config.siteName;
        this.siteName = config.siteName;
        this.dateRegex = config.dateRegex ? (new RegExp(config.dateRegex)) : /\d{4}-\d{2}-\d{2}/;
        this.timeRegex = config.timeRegex ? (new RegExp(config.timeRegex)) : /\d{2}:\d{2}:\d{2}/;

        this.fileDir = config.fileDir;
        this.timestamp = timestamp;
    }

    async fetchPageData(n) {
        // This method should be overridden by subclasses
        throw new Error('fetchPageData not implemented');
    }

    getDateTimeFromStr(str) {
        const dateMatch = str.match(this.dateRegex);
        const date = dateMatch ? dateMatch[0] : null;
        const timeMatch = str.match(this.timeRegex);
        const time = timeMatch ? timeMatch[0] : null;
        if (date && time) {
            return `${date} ${time}`;
        } else if (date) {
            return date;
        } else {
            throw new Error('Error parsing date and time from string');
        }
    }

    isTimeBeforeSpecificTime(newsTime, specificTime) {
        if (!newsTime) {
            return false;
        }
        const newsDateTime = new Date(newsTime).getTime();
        const specificDateTime = new Date(specificTime).getTime();
        return newsDateTime >= specificDateTime;
    }

    async getTotalPages() {
        // This method should be overridden by subclasses
        throw new Error('getTotalPages not implemented');
    }

    async getOldestDateTime(totalPages) {
        // This method should be overridden by subclasses
        throw new Error('getOldestDateTime not implemented');
    }

    async saveToJsonFile() {
        try {
            const newsJson = JSON.stringify(this.allNews.reverse(), null, 2);
            fs.writeFileSync(`${this.fileDir}${this.timestamp.slice(9, 15)}.json`, newsJson, 'utf8');
            console.log(`${(this.siteName+":").padEnd(10, " ")}${this.numberCounter} items fetched,\tsaved at ${this.fileDir}${this.timestamp.slice(9, 15)}.json`);
            return {
                "writeStatus": "success",
                "filePath": `${this.fileDir}${this.timestamp.slice(9, 15)}.json`
            };
        } catch (error) {
            throw new Error(`Error saving ${this.siteName} news to file: ${error.message}`);
        }
    }

    async performFetchAllNews() {
        try {
            let totalPages = await this.getTotalPages();
            if (this.earliestDateTime === 'all') {
                let oldestDateTime = await this.getOldestDateTime(totalPages);
                while (!oldestDateTime && totalPages > 1) {
                    oldestDateTime = await this.getOldestDateTime(--totalPages);
                }
                this.earliestDateTime = oldestDateTime;
            }

            await this.fetchAndProcessPages(totalPages);

            const writeInfo = await this.saveToJsonFile();
            return {
                "nickName": this.nickName,
                "status": (writeInfo.writeStatus === "success" ||
                    writeInfo.writeStatus === "null") ? "success" : "failed",
                "siteName": this.siteName,
                "number": this.numberCounter,
                "fileInfo": writeInfo
            };
        } catch (error) {
            console.error(`Error fetching all news of ${this.siteName}:`, error);
            return {
                "status": "failed",
                "siteName": this.siteName,
                "error": {
                    "message": error.message,
                    "stack": error.stack
                }
            };
        }
    }

    async fetchAndProcessPages(totalPages) {
        // This method should be overridden by subclasses
        throw new Error('fetchAndProcessPages not implemented');
    }

    async processNewsElement(li, datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter, continueFetching) {
        // This method should be overridden by subclasses
        throw new Error('processNewsElement not implemented');
    }

    handleDateTimeErrors(datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter, isValidDateTime) {
        if (isValidDateTime && datetimeErrorCount > 0) {
            this.allNews.push(...datetimeErrorList);
            datetimeErrorCount = 0;
            datetimeErrorList = [];
            this.numberCounter = datetimeErrorNumberCounter;
        }
        if (!isValidDateTime) {
            datetimeErrorCount++;
            if (datetimeErrorCount === 1) {
                datetimeErrorNumberCounter = this.numberCounter;
            }
        }
        return { datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter };
    }
}

class PageFetcher extends NewsFetcher {
    constructor(config, timestamp) {
        super(config, timestamp);
        this.newsModuleIdClass = config.newsModuleIdClass;
        this.totalPagesIdClass = config.totalPagesIdClass;
    }

    async fetchPageData(n) {
        try {
            const url = this.urlTemplate.replace("{n}", n);
            const response = await fetch(url);
            const data = await response.text();
            const dom = new JSDOM(data);
            return dom.window.document;
        } catch (error) {
            throw new Error(`Error fetching the contents: ${error.message}`);
        }
    }

    async getTotalPages() {
        try {
            const firstDoc = await this.fetchPageData(1);
            const totalPagesElement = firstDoc.querySelector(this.totalPagesIdClass);
            const totalPagesMatch = totalPagesElement.textContent.match(/(\d+)\/(\d+)/);
            const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[2], 10) : parseInt(totalPagesElement.textContent, 10);
            return totalPages;
        } catch (error) {
            throw new Error(`Error getting total pages: ${error.message}`);
        }
    }

    async getOldestDateTime(totalPages) {
        try {
            const lastDoc = await this.fetchPageData(totalPages);
            const newsDiv = lastDoc.querySelector(this.newsModuleIdClass);
            const liElements = newsDiv.querySelectorAll('li');
            const oldestDateTime = this.getDateTimeFromStr(liElements[liElements.length - 1].textContent);
            return oldestDateTime;
        }
        catch (error) {
            throw new Error(`Error getting the oldest date: ${error.message}`);
        }
    }

    async fetchAndProcessPages(totalPages) {
        let datetimeErrorCount = 0;
        let datetimeErrorList = [];
        let datetimeErrorNumberCounter = 0;

        let continueFetching = true;
        let pageNumber = 1;
        while (continueFetching && pageNumber <= totalPages) {
            const document = await this.fetchPageData(pageNumber);
            const newsElements = document.querySelector(this.newsModuleIdClass).querySelectorAll('li');
            for (const li of newsElements) {
                ({ datetimeErrorCount, datetimeErrorNumberCounter, continueFetching } = await this.processNewsElement(
                    li,
                    datetimeErrorCount,
                    datetimeErrorList,
                    datetimeErrorNumberCounter,
                    continueFetching
                ));
                if (!continueFetching) {
                    break;
                }
            }
            pageNumber++;
        }
    }

    async processNewsElement(li, datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter, continueFetching) {
        const aTag = li.querySelector('a');
        const title = aTag.title || aTag.textContent.trim();
        let link = aTag.getAttribute('href');
        if (link.startsWith('/')) {
            link = this.linkTemplate + link;
        } else if (!link.startsWith('http')) {
            link = this.linkTemplate.replace('{id}', link);
        }
        const datetime = this.getDateTimeFromStr(li.textContent);
        const isDateTimeValid = this.isTimeBeforeSpecificTime(datetime, this.earliestDateTime);
        if (aTag && isDateTimeValid) {
            ({ datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter } = this.handleDateTimeErrors(
                datetimeErrorCount,
                datetimeErrorList,
                datetimeErrorNumberCounter,
                true
            ));
            this.numberCounter++;
            this.allNews.push({
                // "number": ++this.numberCounter,
                "link": link,
                "title": title,
                "datetime": datetime
            });
        } else if (aTag) {
            ({ datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter } = this.handleDateTimeErrors(
                datetimeErrorCount,
                datetimeErrorList,
                datetimeErrorNumberCounter,
                false
            ));
            datetimeErrorNumberCounter++;
            datetimeErrorList.push({
                // "number": ++datetimeErrorNumberCounter,
                "link": link,
                "title": title,
                "datetime": datetime
            });
        }
        if (this.numberCounter >= this.maxNumber || datetimeErrorCount > 3) {
            continueFetching = false;
        }
        return { datetimeErrorCount, datetimeErrorNumberCounter, continueFetching };
    }
}

class JsonFetcher extends NewsFetcher {
    constructor(config, timestamp) {
        super(config, timestamp);
        this.datetimeIndex = config.datetimeIndex || 'datetime';
        this.titleIndex = config.titleIndex || 'title';
        this.linkIndex = config.linkIndex || 'link';
    }

    async getTotalPages() {
        try {
            const firstPageData = await this.fetchPageData(1);
            const totalPages = firstPageData.totalPage;
            return totalPages;
        } catch (error) {
            throw new Error(`Error getting total pages: ${error.message}`);
        }
    }

    async getOldestDateTime(totalPages) {
        try {
            const lastPage = await this.fetchPageData(totalPages);
            if (!lastPage) {
                return null;
            }
            const lastPageData = lastPage.items;
            const oldestDateTime = this.getDateTimeFromStr(lastPageData[lastPageData.length - 1][this.datetimeIndex]);
            return oldestDateTime;
        }
        catch (error) {
            throw new Error(`Error getting the oldest date: ${error.message}`);
        }
    }

    async fetchAndProcessPages(totalPages) {
        let datetimeErrorCount = 0;
        let datetimeErrorList = [];
        let datetimeErrorNumberCounter = 0;

        let continueFetching = true;
        let pageNumber = 1;
        while (continueFetching && pageNumber <= totalPages) {
            const pageData = await this.fetchPageData(pageNumber);
            const newsElements = pageData.items;
            for (const item of newsElements) {

                ({ datetimeErrorCount, datetimeErrorNumberCounter, continueFetching } = await this.processNewsElement(
                    item,
                    datetimeErrorCount,
                    datetimeErrorList,
                    datetimeErrorNumberCounter,
                    continueFetching
                ));
                if (!continueFetching) {
                    break;
                }
            }
            pageNumber++;
            // 为了避免频繁请求微信公众号，每爬取一页数据后休眠1秒
            if (this.siteName.startsWith('wxpub_')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async processNewsElement(item, datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter, continueFetching) {
        const title = item[this.titleIndex];
        let link = item[this.linkIndex];
        if (link.startsWith('/')) {
            link = this.linkTemplate + link;
        } else if (!link.startsWith('http')) {
            link = this.linkTemplate.replace('{id}', link);
        }
        const datetime = this.getDateTimeFromStr(item[this.datetimeIndex]);
        const isDateTimeValid = this.isTimeBeforeSpecificTime(datetime, this.earliestDateTime);
        if (isDateTimeValid) {
            ({ datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter } = this.handleDateTimeErrors(
                datetimeErrorCount,
                datetimeErrorList,
                datetimeErrorNumberCounter,
                true
            ));
            this.numberCounter++;
            this.allNews.push({
                // "number": ++this.numberCounter,
                "link": link,
                "title": title,
                "datetime": datetime
            });
        } else {
            ({ datetimeErrorCount, datetimeErrorList, datetimeErrorNumberCounter } = this.handleDateTimeErrors(
                datetimeErrorCount,
                datetimeErrorList,
                datetimeErrorNumberCounter,
                false
            ));
            datetimeErrorNumberCounter++;
            datetimeErrorList.push({
                // "number": ++datetimeErrorNumberCounter,
                "link": link,
                "title": title,
                "datetime": datetime
            });
        }
        if (this.numberCounter >= this.maxNumber || datetimeErrorCount > 3) {
            continueFetching = false;
        }
        return { datetimeErrorCount, datetimeErrorNumberCounter, continueFetching };
    }
}

class ZdbkFetcher extends JsonFetcher {
    constructor(config, timestamp) {
        super(config, timestamp);
        this.baseUrl = "http://zdbk.zju.edu.cn";
        this.urlTemplate = this.baseUrl + "/jwglxt/xtgl/xwck_cxMoreLoginNews.html?doType=query";
        this.linkTemplate = this.baseUrl + "/jwglxt/xtgl/xwck_ckLoginNews.html?xwbh={id}";
        this.datetimeIndex = "fbsj";
        this.titleIndex = "xwbt";
        this.linkIndex = "xwbh";
    }
    async fetchPageData(n) {
        try {
            const formData = new URLSearchParams({
                _search: 'false',
                'queryModel.showCount': '15',
                'queryModel.currentPage': n.toString(),
                'queryModel.sortName': 'sfzd desc,fbsj',
                'queryModel.sortOrder': 'desc',
                time: '0'
            });
            const response = await fetch(this.urlTemplate, { method: 'POST', body: formData });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        } catch (error) {
            throw new Error(`Error fetching the contents: ${error.message}`);
        }
    }
}

class WxpubFetcher extends JsonFetcher {
    constructor(config, timestamp) {
        super(config, timestamp);
        this.baseUrl = "https://mp.weixin.qq.com";
        this.urlTemplate = this.baseUrl + "/cgi-bin/appmsgpublish";
        // this.linkTemplate = this.baseUrl + (config.linkTemplate || '');
        this.pubId = config.pubId;
        this.wxpubCookie = fs.readFileSync('./wxpubcookie.txt', 'utf8');
    }

    async getResponse(n) {
        // console.log(`Fetching page ${n} of ${this.siteName}...`);
        const headers = {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
            "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Microsoft Edge\";v=\"120\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-requested-with": "XMLHttpRequest",
            "cookie": this.wxpubCookie,
            "Referer": `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit&isNew=1&type=77&createType=0&token=1295203505&lang=zh_CN&timestamp=${Math.round(new Date().getTime() / 1000 - 100)}`,
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"
        };
        const params = {
            "sub": "list",
            "search_field": "",
            "begin": (n - 1) * 10,
            "count": 10,
            "query": "",
            "fakeid": this.pubId,
            "type": "101_1",
            "free_publish_type": 1,
            "sub_action": "list_ex",
            "token": 1295203505,
            "lang": "zh_CN",
            "f": "json",
            "ajax": 1
        };
        const url = new URL(this.urlTemplate);
        url.search = new URLSearchParams(params).toString();
        const response = await fetch(url, {
            "headers": headers,
            "body": null,
            "method": "GET"
        });
        return response;
    }

    getDateTimeFromTimestamp(timestamp) {
        const dateObject = new Date(timestamp * 1000);
        const date = new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(dateObject)
            .replace(/[\u200E\u200F]/g, '')
            .replace(/\//g, '-')
        return date;
    }

    async fetchPageData(n) {
        try {
            const response = await this.getResponse(n);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const dataObject = await response.json();
            if (dataObject.base_resp.err_msg === 'freq control') {
                throw new Error('frequent control');
            }

            // 数据预处理
            let publishPage = JSON.parse(dataObject.publish_page);
            let publishList = publishPage.publish_list;

            let fetchedData = {};
            let articleList = [];

            fetchedData.currentPage = n;
            fetchedData.totalPage = Math.ceil(publishPage.total_count / 5);

            publishList.forEach((item) => {
                const itemJson = JSON.parse(item.publish_info);
                const itemInfo = itemJson.appmsgex[0];
                const datetime = this.getDateTimeFromTimestamp(itemJson.sent_info.time);
                const dictmp = {
                    "link": itemInfo.link,
                    "title": itemInfo.title,
                    "datetime": datetime
                };
                articleList.push(dictmp);
                // console.log(dictmp);
            });
            fetchedData.items = articleList;
            return fetchedData;
        } catch (error) {
            throw new Error(`Error fetching the contents: ${error.message}`);
        }
    }
}

class fetchNewsFromSource {
    constructor(sourceConfigsJSONFile, fetchSources) {
        try {
            this.originTimestamp = this.getTimestamp().replace(/\//g, '-');
            this.timestamp = this.originTimestamp.replace(/-/g, '').replace(/:/g, '').replace(/ /g, '_');
            this.indexDir = `./data/index/`;
            fs.mkdirSync(this.indexDir, { recursive: true });
            fs.mkdirSync(`${this.indexDir}/logs`, { recursive: true });
            // 如果fetchSources是字符串或字典，转换为数组
            this.fetchSourcesArray = [];
            if (typeof fetchSources === 'string') {
                this.fetchSourcesArray.push(fetchSources);
            } else if (Array.isArray(fetchSources)) {
                this.fetchSourcesArray = fetchSources;
            } else if (typeof fetchSources === 'object') {
                for (const source in fetchSources) {
                    if (fetchSources[source] === true) {
                        this.fetchSourcesArray.push(source);
                    }
                }
            }

            for (const source of this.fetchSourcesArray) {
                fs.mkdirSync(`${this.indexDir}${source}/${this.timestamp.slice(0, 8)}/`, { recursive: true });
            }

            const sourceConfigs = fs.readFileSync(sourceConfigsJSONFile, 'utf8');
            this.sourceConfigs = JSON.parse(sourceConfigs);
            this.fetchSourcesConfigsArray = [];
            for (const source of this.fetchSourcesArray) {
                const config = this.sourceConfigs[source];
                config.fileDir = `${this.indexDir}${source}/${this.timestamp.slice(0, 8)}/`;
                this.fetchSourcesConfigsArray.push(config);
            }
        } catch (err) {
            // throw new Error(`Error initializing fetchNewsFromSource: ${err.message}`);
            console.error(`Error initializing fetchNewsFromSource: ${err.message}`);
        }
    }

    getTimestamp() {
        const timestamp = new Date().toLocaleString('zh-CN', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/[\u200E\u200F]/g, '');
        return timestamp;
    }

    saveLogs(fetchNewsResult) {
        try {
            const filePath = fetchNewsResult.logsFilePath;
            fs.writeFileSync(filePath, JSON.stringify(fetchNewsResult, null, 2), 'utf8');
            console.log(`${"logs:".padEnd(10, " ")}${fetchNewsResult.successNumber} succeed, ${fetchNewsResult.failedNumber} failed, saved at ${fetchNewsResult.logsFilePath}`);
        } catch (err) {
            console.error('Error saving log file:', err);
        }
    }

    async fetchNews(config) {
        let fetcher;
        if (config.type === 'json') {
            // fetcher = new JsonFetcher(config);
            if (config.siteName === 'zdbk') {
                fetcher = new ZdbkFetcher(config, this.timestamp);
            } else if (config.siteName.startsWith('wxpub_')) {
                fetcher = new WxpubFetcher(config, this.timestamp);
            } else {
                throw new Error('Unsupported json fetcher type');
            }
        } else if (config.type === 'page') {
            fetcher = new PageFetcher(config, this.timestamp);
        } else {
            throw new Error('Unsupported fetcher type');
        }
        const fileStatus = await fetcher.performFetchAllNews();
        return fileStatus;
    }

    async fetchAllNews() {
        try {
            const promises = this.fetchSourcesConfigsArray.map(item => this.fetchNews(item));
            const fetchStatusArray = await Promise.all(promises);
            console.log();

            let lastUpdateTime = {};
            if (fs.existsSync(`${this.indexDir}/logs/last_update_time.json`)) {
                lastUpdateTime = fs.readFileSync(`${this.indexDir}/logs/last_update_time.json`, 'utf8');
                lastUpdateTime = JSON.parse(lastUpdateTime);
            }

            let successNumber = 0;
            let failedNumber = 0;
            let successFetches = {};
            let failedFetches = {};
            for (const fetchStatus of fetchStatusArray) {
                if (fetchStatus.status === 'success') {
                    successNumber += 1;
                    successFetches[fetchStatus.siteName] = fetchStatus;
                    lastUpdateTime[fetchStatus.siteName] = this.originTimestamp;
                } else if (fetchStatus.status === 'failed') {
                    failedNumber += 1;
                    failedFetches[fetchStatus.siteName] = fetchStatus;
                    if (lastUpdateTime[fetchStatus.siteName] === undefined) {
                        lastUpdateTime[fetchStatus.siteName] = 'unknown';
                    }
                }
            }

            fs.writeFileSync(`${this.indexDir}/logs/last_update_time.json`, JSON.stringify(lastUpdateTime, null, 2), 'utf8');

            let fetchAllNewsResult = {
                "updateTimeStamp": this.originTimestamp,
                "logsFilePath": `${this.indexDir}logs/${this.timestamp}_all.json`,
                "runSuccess": true,
                "allSuccess": successNumber === this.fetchSourcesArray.length,
                "fetchSources": this.fetchSourcesArray,
                "successNumber": successNumber,
                "successFetches": successFetches,
                "failedNumber": failedNumber,
                "failedFetches": failedFetches
            };
            this.saveLogs(fetchAllNewsResult);
            return fetchAllNewsResult;
        } catch (err) {
            console.error('Error fetching all news:', err);
            let fetchAllNewsResult = {
                "updateTimeStamp": this.originTimestamp,
                "logsFilePath": `${this.indexDir}logs/${this.timestamp}_all.json`,
                "runSuccess": false,
                "error": {
                    "message": err.message,
                    "stack": err.stack
                }
            };
            this.saveLogs(fetchAllNewsResult);
            return fetchAllNewsResult;
        }
    }

    // 增量式抓取新闻
    async fetchIncrementalNews() {
        try {
            let lastUpdateTime = {};
            if (fs.existsSync(`${this.indexDir}/logs/last_update_time.json`)) {
                lastUpdateTime = fs.readFileSync(`${this.indexDir}/logs/last_update_time.json`, 'utf8');
                lastUpdateTime = JSON.parse(lastUpdateTime);
            }

            // for (const source of this.fetchSourcesArray) {
            //     if (lastUpdateTime.hasOwnProperty(source) && lastUpdateTime[source] != 'unknown') {
            //         this.fetchSourcesConfigsArray[source].earliestDateTime = lastUpdateTime[source].slice(0, 10);
            //     }
            // }
            for (let i = 0; i < this.fetchSourcesArray.length; i++) {
                const source = this.fetchSourcesArray[i];
                if (lastUpdateTime.hasOwnProperty(source) && lastUpdateTime[source] != 'unknown') {
                    this.fetchSourcesConfigsArray[i].earliestDateTime = lastUpdateTime[source].slice(0, 10);
                }
            }

            const promises = this.fetchSourcesConfigsArray.map(item => this.fetchNews(item));
            const fetchStatusArray = await Promise.all(promises);
            console.log();

            let successNumber = 0;
            let failedNumber = 0;
            let successFetches = {};
            let failedFetches = {};
            for (const fetchStatus of fetchStatusArray) {
                if (fetchStatus.status === 'success') {
                    successNumber += 1;
                    successFetches[fetchStatus.siteName] = fetchStatus;

                    const fetchedNewsJson = fs.readFileSync(fetchStatus.fileInfo.filePath, 'utf8');
                    const fetchedNews = JSON.parse(fetchedNewsJson);

                    const latestNewsUpdateTime = lastUpdateTime[fetchStatus.siteName] ? lastUpdateTime[fetchStatus.siteName].replace(/-/g, '').replace(/:/g, '').replace(/ /g, '_') : 'unknown';

                    if (latestNewsUpdateTime === 'unknown') {
                        console.log(`${(fetchStatus.siteName+":").padEnd(10, " ")}${successFetches[fetchStatus.siteName].number} items added,\tsaved at ${fetchStatus.fileInfo.filePath}`);
                        lastUpdateTime[fetchStatus.siteName] = this.originTimestamp;
                        continue;
                    }

                    const latestNewsJsonFilePath = `${this.indexDir}${fetchStatus.siteName}/${latestNewsUpdateTime.slice(0, 8)}/${latestNewsUpdateTime.slice(9, 15)}.json`;
                    // console.log(latestNewsJsonFilePath);
                    const latestNewsJson = fs.readFileSync(latestNewsJsonFilePath, 'utf8');
                    let latestNews = JSON.parse(latestNewsJson);

                    for (const news of fetchedNews) {
                        let isNewsExist = false;
                        for (let i = latestNews.length - 1; i >= 0; i--) {
                            if (news.link === latestNews[i].link || news.datetime > latestNews[i].datetime) {
                                isNewsExist = true;
                                successFetches[fetchStatus.siteName].number -= 1;
                                break;
                            }
                        }
                        if (!isNewsExist) {
                            latestNews.push(news);
                        }
                    }

                    fs.writeFileSync(fetchStatus.fileInfo.filePath, JSON.stringify(latestNews, null, 2), 'utf8');
                    console.log(`${(fetchStatus.siteName+":").padEnd(10, " ")}${successFetches[fetchStatus.siteName].number} items added,\tsaved at ${fetchStatus.fileInfo.filePath}`);

                    lastUpdateTime[fetchStatus.siteName] = this.originTimestamp;
                } else if (fetchStatus.status === 'failed') {
                    failedNumber += 1;
                    failedFetches[fetchStatus.siteName] = fetchStatus;
                    // if (lastUpdateTime[fetchStatus.siteName] === undefined) {
                    //     lastUpdateTime[fetchStatus.siteName] = 'unknown';
                    // }
                }
            }
            console.log();

            fs.writeFileSync(`${this.indexDir}/logs/last_update_time.json`, JSON.stringify(lastUpdateTime, null, 2), 'utf8');

            let fetchIncrementalNewsResult = {
                "updateTimeStamp": this.originTimestamp,
                "logsFilePath": `${this.indexDir}logs/${this.timestamp}_incremental.json`,
                "runSuccess": true,
                "allsuccess": successNumber === this.fetchSourcesArray.length,
                "fetchSources": this.fetchSourcesArray,
                "successNumber": successNumber,
                "successFetches": successFetches,
                "failedNumber": failedNumber,
                "failedFetches": failedFetches
            };
            this.saveLogs(fetchIncrementalNewsResult);
            return fetchIncrementalNewsResult;
        } catch (err) {
            console.error('Error fetching incremental news:', err);
            let fetchIncrementalNewsResult = {
                "updateTimeStamp": this.originTimestamp,
                "logsFilePath": `${this.indexDir}logs/${this.timestamp}_incremental.json`,
                "runSuccess": false,
                "error": {
                    "message": err.message,
                    "stack": err.stack
                }
            };
            this.saveLogs(fetchIncrementalNewsResult);
            return fetchIncrementalNewsResult;
        }
    }
}

async function fetchNews(sourceConfigsJSONFile, fetchSources, incremental = false) {
    const fetcher = new fetchNewsFromSource(sourceConfigsJSONFile, fetchSources);
    let fetchResult;
    if (incremental) {
        fetchResult = await fetcher.fetchIncrementalNews();
    } else {
        fetchResult = await fetcher.fetchAllNews();
    }
    return fetchResult;
}

// module.exports.zjufetch = {
//     fetchNews
// };

module.exports = fetchNews;