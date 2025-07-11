import puppeteer from 'puppeteer';
import { EventEmitter } from 'node:events';
import * as fsp from 'node:fs/promises';
import * as fs from 'node:fs';
import axios from 'axios';

import dotenv from 'dotenv';
dotenv.config();

const USER_NAME = process.env.USER_NAME
const PASSWORD = process.env.PASSWORD
const START_URL = process.env.START_URL
const MUTE = process.argv.includes('--mute') || process.env.MUTE === 'true' || process.env.MUTE === '1';

if (MUTE) console.log = () => {};
const getID = (() => {
    let myId = 0
    return () => {
        return ++myId;
    }
})();

const extractUserId = (url) => {
    const regex = /\/user\/(\d+)/
    const match = url.match(regex);
    if (match) {
        return match[1];
    }
    throw new Error('Invalid Facebook URL format');
    
}

class fileEmitter extends EventEmitter {}
const fileEvent = new fileEmitter();
class imgEmitter extends EventEmitter {
    async downloadImage(url, index, imgPrefix) {
        try {
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'stream',
            });
        
            const ext = '.jpg';
            const filename = `${imgPrefix}_${index}${ext}`;
            const writer = fs.createWriteStream(`images/${filename}`);
        
            response.data.pipe(writer);
        
            return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                // console.log(`✅ Downloaded: ${filename}`);
                resolve();
            });
            writer.on('error', reject);
            });
        } catch (err) {
            console.error(`❌ Error downloading ${url}:`, err.message);
        }
    }

    async downloadAllImages(imgPaths, imgPrefix) {
        for (let i = 0; i < imgPaths.length; i++) {
          await this.downloadImage(imgPaths[i], i + 1, imgPrefix);
        }
    }
}
const imgEvent = new imgEmitter();

imgEvent.on('init', () => {
    // Create a new directory for images
    console.log('Image initialization started...');
    fsp.mkdir('images', { recursive: true })
        .then(() => console.log('Image directory initialized successfully.'))
        .catch(err => console.error('Error initializing image directory:', err));
})

imgEvent.on('fetch', async (urls, imgPrefix, processID) => {
    if (!urls || urls.length === 0) {
        console.error('No image URLs provided.');
        return;
    }
    // console.log('Fetching images from URLs:');
    await imgEvent.downloadAllImages(urls, imgPrefix)
    console.log(`(${processID}) ` + 'Images fetched successfully:', urls.length, 'images saved with prefix:', imgPrefix);
});

const extractImgRef = (postUrl, permalink, imgPaths, processID) => {
    const postLinkRegex = /fbid=(\d+)&set=g\.(\d+)/;
    const permalinkRegex = /groups\/(\d+)\/permalink\/(\d+)/ 
    const match = permalink ? permalink.match(permalinkRegex) : postUrl.match(postLinkRegex);
    if (!match) throw new Error(`(${processID}) ` + 'Invalid URL format for extracting image reference');
    const postId = permalink ? match[2] : match[1];
    const groupId = permalink ? match[1] : match[2];
    const imgPrefix = `${groupId}_${postId}`;
    imgEvent.emit('fetch', imgPaths, imgPrefix, processID); // Emit event to fetch images
    return imgPaths.map((_, index) => `${imgPrefix}_${index + 1}.jpg`); // Return the paths where images are saved
}

fileEvent.on('init', () => {
    // Create a new file
    console.log('File initialization started...');
    fsp.writeFile('data.jsonl', '', 'utf8')
        .then(() => console.log('File initialized successfully.'))
        .catch(err => console.error('Error initializing file:', err));
})

fileEvent.on('write', (data) => {
    // Write data to the file
    // Data example: 
    /*
        {
            author: 'Author Name',
            title: 'Post Title',
            postUrl: 'https://www.facebook.com/post-url',
            permalink: 'https://www.facebook.com/groups/group-id/permalink/post-id',
            imgPaths: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
        }
    */
    const processID = getID();
    if (data.author === '' || data.postUrl === '') return // Skip writing if author or postUrl is empty
    console.log(`(${processID}) ` + 'Writing data from post:', data.permalink ? data.permalink : data.postUrl);
    data.imgPaths = extractImgRef(data.postUrl, data.permalink, data.imgPaths, processID) || data.imgPaths;
    fsp.appendFile('data.jsonl', JSON.stringify(data) + '\n', 'utf8')
        .then(() => {
            console.log(`(${processID}) ` + 'Data written successfully.')
        })
        .catch(err => console.error('Error writing data:', err));
})

const login = async (page) => {
    await page.evaluate(async (USER_NAME, PASSWORD) => {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
        document.querySelector('#email').value = USER_NAME
        document.querySelector('#pass').value = PASSWORD
        document.querySelector('button[name="login"]').click()
    }, USER_NAME, PASSWORD);
    // await page.type('#email', USER_NAME, { delay: 100 });
    // await page.type('#pass', PASSWORD, { delay: 100 });
    // await page.click('button[name="login"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 300000 });
    console.log('Login successful.');
}

const scrape = async () => {
    const browser = await puppeteer.launch({ headless: false, protocolTimeout: 0, args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'] })
    const page = await browser.newPage()
    page.setDefaultTimeout(0)
    page.setDefaultNavigationTimeout(300000)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')
    
    await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle2',
        timeout: 300000
    });
    
    await login(page);
    
    await page.goto(START_URL, {
        waitUntil: 'networkidle2',
        timeout: 300000
    });

    // Close the modal
    await page.waitForSelector('[aria-modal="true"][role="alertdialog"] button');
    await page.$eval('[aria-modal="true"][role="alertdialog"] button', el => el.click());

    const dynamicLinkSelector = '[role="complementary"] span[dir] a' // Either link to full post or author's profile
    const authorUrlSelector = '[role="complementary"] h2 a' // Link to author's profile
    const nextBtnSelector = '[data-name="media-viewer-nav-container"] [data-visualcompletion="ignore-dynamic"]:last-child>[role="button"]'
    const seeMoreSelector = '[role="complementary"] [dir="auto"] [role="button"]'
    const imgSelector = '[data-name="media-viewer-nav-container"] + div img'

    let previousePermalink = '';
    let attempt = 1;
    const postData = {
        author: '',
        userID: '',
        postUrl: '',
        permalink: '',
        title: '',
        imgPaths: []
    }
    while (true) {
        try {
            // console.log(`(${attempt}) Url:`, page.url());
            await page.waitForSelector(dynamicLinkSelector, { timeout: 10000 });
            if (page.url().includes('videos')) {
                const nextBtn = await page.$(nextBtnSelector);
                if (!nextBtn) {
                    console.log('No next button found, exiting...');
                    break;
                }

                await Promise.all([
                    page.waitForNavigation(),
                    nextBtn.click(),
                ]);

                await new Promise(r => setTimeout(r, 200));
                attempt++;
                continue
            }
            const dynamicLink = await page.$eval(dynamicLinkSelector, el => el.href).catch(() => null);
            if (!dynamicLink?.includes('permalink')) {
                // Save previous post data if it exists
                if (previousePermalink !== '') {
                    previousePermalink = '';
                    postData.permalink = '';
                    fileEvent.emit('write', postData); // Emit event to write data to file
                    // console.log(postData);
                }
                const author = await page.$eval(dynamicLinkSelector, el => el.textContent).catch(() => 'No author found');
                await page.waitForSelector(authorUrlSelector, { timeout: 10000 }).catch(() => null);
                const userID = await page.$eval(authorUrlSelector, el => el.href).then(url => extractUserId(url)).catch(() => null);
                await page.$eval(seeMoreSelector, el => el.click()).catch(() => null);
                const title = await page.evaluate((postBodySelector) => {
                    const bod = document.querySelectorAll(postBodySelector)
                    const title = bod[2]?.textContent || '';
                    return title;
                },'[role="complementary"] [dir="auto"]')
                const imgUrl = await page.$eval(imgSelector, el => el.src).catch(() => null);
                postData.author = author;
                postData.userID = userID;
                postData.postUrl = page.url();
                postData.title = title;
                postData.imgPaths = imgUrl ? [imgUrl] : [];
            }

            if (dynamicLink?.includes('permalink')) {
                if (previousePermalink !== dynamicLink) {
                    // Save previous post data if it exists
                    // console.log(postData);
                    fileEvent.emit('write', postData); // Emit event to write data to file

                    postData.author = '';
                    postData.title = '';
                    await page.waitForSelector(authorUrlSelector, { timeout: 10000 }).catch(() => null);
                    postData.userID = await page.$eval(authorUrlSelector, el => el.href).then(url => extractUserId(url)).catch(() => null);
                    postData.postUrl = page.url();
                    postData.permalink = '';
                    postData.imgPaths = [];
                    previousePermalink = dynamicLink;
                    await page.waitForSelector(dynamicLinkSelector, { timeout: 10000 }).catch(() => null);
                    await page.$eval(dynamicLinkSelector, el => el.click());
                    const dialogsSelector = '[role="dialog"]'
                    await page.waitForSelector(dialogsSelector, { timeout: 2000 }).catch(() => null);
                    await page.waitForSelector('[dir="ltr"]', { timeout: 2000 }).catch(() => null);
                    await page.waitForSelector('[data-ad-preview="message"]', { timeout: 2000 }).catch(() => null);
                    await page.waitForSelector('[data-ad-preview="message"] [dir="auto"] [role="button"]', { timeout: 2000 }).catch(() => null);
                    const { seeMoreBtnExist, author } = await page.evaluate((dialogsSelector) => {
                        const dialogs = document.querySelectorAll(dialogsSelector);
                        const post = dialogs[dialogs.length-1]
                        if (!post) return null;
                        const ltrs = post.querySelectorAll('[dir="ltr"]')
                        const author = ltrs[ltrs.length-1]?.querySelector('a')?.textContent || 'No author found';
                        const seeMoreBtn = post.querySelector('[data-ad-preview="message"] [dir="auto"] [role="button"]') || post.querySelector('[data-ad-rendering-role="story_message"] [dir="auto"] [role="button"]')
                        const seeMoreBtnExist = seeMoreBtn !== null;
                        return { seeMoreBtnExist, author };
                    }, dialogsSelector);
                    if (seeMoreBtnExist) {
                        await page.waitForSelector('[data-ad-preview="message"] [dir="auto"] [role="button"]', { timeout: 2000 }).catch(() => null);
                        await page.$eval('[data-ad-preview="message"] [dir="auto"] [role="button"]', el => el.click()).catch(() => null);
                        await page.waitForSelector('[data-ad-rendering-role="story_message"] [dir="auto"] [role="button"]', { timeout: 2000 }).catch(() => null);
                        await page.$eval('[data-ad-rendering-role="story_message"] [dir="auto"] [role="button"]', el => el.click()).catch(() => null);
                    }
                    const title = await page.evaluate((dialogsSelector) => {
                        const dialogs = document.querySelectorAll(dialogsSelector);
                        const post = dialogs[dialogs.length-1]
                        const title = post.querySelector('[data-ad-preview="message"]')?.textContent || post.querySelector('[data-ad-rendering-role="story_message"]')?.textContent || '';
                        return title
                    }, dialogsSelector);
                    postData.permalink = page.url();
                    const closeButtonSelector = '[role="dialog"] [aria-label="Đóng"]'
                    await page.$eval(closeButtonSelector, el => el.click()).catch(() => null);
                    postData.author = author;
                    postData.title = title;
                }
                const imgUrl = await page.$eval(imgSelector, el => el.src).catch(() => null);
                postData.imgPaths.push(imgUrl);
            }

            const nextBtn = await page.$(nextBtnSelector);
            if (!nextBtn) {
                console.log('No next button found, exiting...');
                break;
            }

            await Promise.all([
                page.waitForNavigation(),
                nextBtn.click(),
            ]);

            await new Promise(r => setTimeout(r, 200));
            attempt++;
        } catch (err) {
            console.error(`Error at attempt ${attempt}:`, err);
            break;
        }
    }
    await browser.close();
}

const prog = async () => {
    fileEvent.emit('init');
    imgEvent.emit('init');
    try {
        await scrape();
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

prog();