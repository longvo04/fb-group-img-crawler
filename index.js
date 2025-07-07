const download = require('image-downloader')
const fs = require('fs');
const puppeteer = require('puppeteer');
const browserFetcher = puppeteer.createBrowserFetcher();


function timeLogger(type = '', data = '') {
    let ts = Date.now();
    let date_ob = new Date(ts);
    let date = date_ob.getDate();
    if(date < 10) date = '0' + date;
    let month = date_ob.getMonth() + 1;
    if(month < 10) month = '0' + month;
    let hour = date_ob.getHours();
    if(hour < 10) hour = '0' + hour;
    let min = date_ob.getMinutes();
    if(min < 10) min = '0' + min;
    let logTime = fs.createWriteStream('timeLog.txt', {
        flags: 'a'
    })
    let time = `${hour}h${min}p-${date}/${month}`
    logTime.write(`${type}: ${time}\n`)
    logTime.write(`data: ${data}\n\n`)
    logTime.close()
}

let logger = fs.createWriteStream('log.txt', {
    flags: 'a'
})

let fileName  = 1
// 1 : https://www.facebook.com/ColourfulSpace/photos/4326784397399476
const baseUrl = 'https://www.facebook.com/ColourfulSpace/photos/4326784397399476'
logger.write(`${fileName}: ${baseUrl}`)
logger.write('\n')

async function getImgUrl(link) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    page.setDefaultTimeout(300000)
    page.setDefaultNavigationTimeout(300000)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36')
    await page.goto(link, {
        waitUntil: 'networkidle2',
        timeout: 300000
    });
    const data = await page.evaluate(function() {
        let imgUrl = document.querySelector('div[data-pagelet="MediaViewerPhoto"] img[data-visualcompletion="media-vc-image"]')
            if (imgUrl === null) imgUrl = ''
                else imgUrl = imgUrl.src
        let a = document.querySelectorAll('div[data-visualcompletion="ignore-dynamic"]')
        if (a[1] === undefined) return false
        var nextBtn = a[1].querySelector('div:first-child')
        if (nextBtn === null) return false
        nextBtn.click()
        let nextUrl = window.location.href
        return { imgUrl, nextUrl }
    })
    await browser.close()
    return data
}

async function imgDownloader(link) {
    let options = {
        url: link,
        dest: `img/${fileName}.jpg`      // will be saved to /path/to/dest/photo.jpg
    }
    fileName++;

    let res = await download.image(options)
            .then(({ filename }) => {
                console.log('Saved to', filename)
            })
            .catch((err) => {
                timeLogger('download error')
                console.error(err)
            })
    if (res) return true
}

async function process(url) {
    let result = await getImgUrl(url)
    if (!result) {
        timeLogger('line83-Done')
        console.log('Done')
        return
    }
    logger.write(`${fileName+1}: ${result.nextUrl}`)
    logger.write('\n')
    let res = imgDownloader(result.imgUrl)
    if (res) await process(result.nextUrl)
        else {
            timeLogger('line92')
            console.log('error')
            return
        }
}

process(baseUrl)
