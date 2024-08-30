const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const readline = require('readline');

// Configuration
const loginUrl = 'https://myschedule.safeway.com/start.aspx';
const username = 'MYUSERID';
const password = 'MYPASSWORD';
var isHeadless = true;
var whenDateTime = "";

const askInput = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractAndWriteData = async (page) => {
    if (whenDateTime.includes('NW')) {
        await delay(3000);
    }
    console.log('- LOG -- STARTING DATA EXTRACTION -');

    const selector = '.days.row.even.max.last-child.solo.week1.lastweek';

    const elementData = await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [];

        return Array.from(element.children)
            .filter(child => child.tagName === 'LI')
            .map(child => {
                const textContent = child.textContent.trim();
                const dateMatch = textContent.match(/^\d{2}\/\d{2}/);
                const date = dateMatch ? dateMatch[0] : null;

                const hoursMatch = textContent.match(/(\d{1,2}:\d{2}[ap] - \d{1,2}:\d{2}[ap])/);
                const hours = hoursMatch ? hoursMatch[0] : null;

                const extraMatches = textContent.match(/Hours:\s*\d+\.\d+|Store:\s*\d+|Job:.*$/gm);
                const extra = extraMatches || [];

                return date ? {
                    date,
                    hours,
                    extra
                } : null;
            })
            .filter(item => item);
    }, selector);

    const filePath = path.join(__dirname, 'parsed_schedule.json');
    fs.writeFileSync(filePath, JSON.stringify(elementData, null, 2), 'utf-8');
    console.log('- LOG -- SUCCESSFULLY WRITTEN DATA TO \'parsed_schedule.json\' -');
};

const selectSecondOption = async (page) => {
    await page.evaluate(() => {
        var dropdown = document.getElementById("ctl00_masterPlaceHolder_ddlDatePeriod");
        if (dropdown) {
            dropdown.selectedIndex = 1;
            dropdown.dispatchEvent(new Event('change', {
                bubbles: true
            }));
        } else {
            console.error('Dropdown element not found.');
        }
    });
    console.log('- LOG -- SELECTED SECOND OPTION FROM DROPDOWN -');
};

const inputDateAndSubmit = async (page, dateString) => {

    await page.waitForSelector('#ctl00_masterPlaceHolder_txtWeekPeriodDate', {
        visible: true
    });

    await page.evaluate((dateString) => {
        const dateInput = document.querySelector('#ctl00_masterPlaceHolder_txtWeekPeriodDate');
        if (dateInput) {
            dateInput.value = dateString;
            dateInput.dispatchEvent(new Event('change', {
                bubbles: true
            }));
            dateInput.dispatchEvent(new Event('input', {
                bubbles: true
            }));

            const enterEvent = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                key: 'Enter',
                code: 'Enter',
                charCode: 13,
                keyCode: 13,
                which: 13
            });
            dateInput.dispatchEvent(enterEvent);
        } else {
            throw new Error('Date input element not found.');
        }
    }, dateString);
};

const main = async () => {
    const browser = await puppeteer.launch({
        headless: isHeadless
    });
    const page = await browser.newPage();

    try {
        while (true) {
            try {
                await new Promise((resolve) => {
                    askInput.question("- INPUT -- GET SCHEDULE WHEN ? TODAY (EMPTY) - NEXTWEEK (NW) - [ ", (whenDateGet) => {
                        whenDateTime = whenDateGet;
                        if (whenDateGet.includes('NW')) {
                            console.log('- LOG -- GETTING NEXT WEEKS SCHEDULE -')
                        } else {
                            console.log('- LOG -- GETTING THIS WEEKS SCHEDULE -')
                        }
                        resolve(whenDateGet);
                    });
                });

                askInput.close();
            } catch (err) {
                console.error('Error:', err);
            }

            await page.goto(loginUrl);
            await page.setViewport({
                width: 1280,
                height: 720
            });
            console.log(`- LOG -- LOADING URL -`);
            await page.waitForFunction(() => document.readyState === 'complete');
            console.log(`- LOG -- LOADED URL -`);
            await page.click('.loginImg > a:nth-child(1) > img:nth-child(1)');
            console.log(`- LOG -- CLICKED LOGIN BUTTON -`);
            await page.waitForFunction(() => document.readyState === 'complete');
            console.log(`- LOG -- LOADED LOGIN PAGE -`);

            await page.evaluate((username, password) => {
                document.querySelector('#EmpID').value = username;
                document.querySelector('#Password').value = password;
            }, username, password);
            console.log(`- LOG -- ENTERED USER AND PASS -`);

            await page.click('#btnLogIn');
            console.log(`- LOG -- CLICKED LOGIN BUTTON -`);
            await page.waitForFunction(() => document.readyState === 'complete');

            const currentUrl = await page.url();
            if (currentUrl.includes('myschedule.safeway.com')) {
                console.log(`- LOG -- LOADED SCHEDULE PAGE -`);

                await selectSecondOption(page);
                await delay(1000);

                // Calculate date 7 days from now
                const futureDate = moment().add(7, 'days').format('MM/DD/YYYY');
                await inputDateAndSubmit(page, futureDate);
                console.log(`- LOG -- ENTERED DATE ${futureDate} INTO TEXT BOX -`);

                await extractAndWriteData(page);

                break;
            }
        }
    } catch (error) {
        console.log(`- LOG -- OH NO AN ERROR EXECUTNG SCRIPT: ${error} -`);
    } finally {
        if (isHeadless == true) {
            console.log(`- LOG -- EXITING HEADLESS PROCESS uwu -`);
        } else {
            console.log(`- LOG -- EXITING HEADFULL PROCESS uwu -`);
        }
        await browser.close();
    }
};

main();