const ffmpeg = require('fluent-ffmpeg');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { exec } = require('child_process');
const FFplay = require("ffplay");


let chalk;

(async () => {
    chalk = (await import('chalk')).default;
})();

var fileCount = 0, totalFiles = 0, loadingIcon = "|", lastDirectoryName, typeConvCodecVid = 'libx264', typeConvCodecAud = 'aac', whatFunc = '', thisAudioFile = "audio/s1.mp3", processObj, totalDuration, HMDL = 0;

// global Function ----------------------------------------------- global Functions

function executeFFmpegCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            if (error) {
                reject(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                reject(`FFmpeg stderr: ${stderr}`);
                return;
            }
            resolve(stdout);
        });
    });
}

// MKV to MP4 Functions ----------------------------------------------- MKV to MP4 Functions

function secondsToTimeFormat(seconds) {
    seconds = parseFloat(seconds);
    if (isNaN(seconds)) return '00:00:00.00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${pad(hours)}:${pad(minutes)}:${pad(remainingSeconds.toFixed(2))}`;
}

function pad(number) {
    return number.toString().padStart(2, '0');
}

function getVideoDuration(filePath) {
    return new Promise((resolve, reject) => {
        const quotedFilePath = `"${filePath}"`;

        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${quotedFilePath}`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error getting duration: ${stderr}`);
            }
            resolve(parseFloat(stdout));
        });
    });
}

function getResolutionCategory(width, height) {
    if (width >= 3840 && height >= 2160) {
        return '4K';
    } else if (width >= 2560 && height >= 1440) {
        return '2K';
    } else if (width >= 1920 && height >= 1080) {
        return 'HD';
    } else {
        return 'SD';
    }
}

function getBitrate(resolutionCategory) {
    switch (resolutionCategory) {
        case '4K': return '5000k';
        case '2K': return '5000k';
        case 'HD': return '3000k';
        case 'SD': return '1500k';
        default: return '1000k';
    }
}

function printLog(inputFile, percent, resolution, quality) {
    if (loadingIcon == "|") {
        loadingIcon = "/";
    } else if (loadingIcon == "/") {
        loadingIcon = "—";
    } else if (loadingIcon == "—") {
        loadingIcon = "\\";
    } else if (loadingIcon == "\\") {
        loadingIcon = "|";
    }
    const fileName = path.basename(inputFile);
    process.stdout.write("\x1Bc");
    console.log(`--------- [ FILE ${fileCount + 1}/${totalFiles} ]  [ DIRS LEFT ${HMDL} ] ---------`);
    console.log(`-- LOG - PROCESS_NAME: '${whatFunc}' -`);
    console.log(`-- LOG - DIRECTORY: '${lastDirectoryName}' -`);
    console.log(`-- LOG - FILE NAME: '${fileName}' -`);
    console.log(`-- LOG - RES // QUAL // CODEC: '${resolution} // ${quality} // ${typeConvCodecVid}.${typeConvCodecAud}' -`);
    console.log(`-- LOG - PROGRESS // TIME/END: '${percent}% // ${processObj} / ${totalDuration}' -`);
    console.log(`---------------------- [${loadingIcon}] ----------------------`);
}

function openExplorer(dirPath) {
    const platform = process.platform;

    let command;

    const escapedDirPath = `"${dirPath}"`;

    if (platform === 'win32') {
        command = `explorer ${escapedDirPath}`;
    } else if (platform === 'darwin') {
        command = `open ${escapedDirPath}`;
    } else if (platform === 'linux') {
        command = `xdg-open ${escapedDirPath}`;
    } else {
        console.log('Platform not supported for opening Explorer');
        return;
    }

    exec(command, (err, stdout, stderr) => {
        if (err && stderr) {
            console.log("Error opening Explorer, but continuing:", err);
        }

        if (stdout) {
            console.log("stdout:", stdout);
        }
        if (stderr) {
            console.log("stderr:", stderr);
        }

        console.log(`Opened Explorer/Finder for: ${escapedDirPath}`);
    });
}

// MKV to MP4 FUNCTIONS ----------------------------------------------- MKV to MP4 FUNCTIONS

async function convertMKVtoMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            // lastDirectoryName = path.basename(inputPath);
            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const mkvFiles = files.filter(file => path.extname(file).toLowerCase() === '.mkv');
            totalFiles = mkvFiles.length;

            for (const file of mkvFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.mkv')}.mp4`);
                try {
                    await MKVtoMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.mkv') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await MKVtoMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not an MKV file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function MKVtoMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// CDA FUNCTIONS ----------------------------------------------- CDA FUNCTIONS

async function ripCD(cdDevicePath, outputDirectory, trackNumber) {
    try {
        if (trackNumber === '*') {
            let probeCommand;

            if (process.platform === 'win32') {
                probeCommand = `ffmpeg -f dshow -i audio="CD Audio" -vn -f null -`;
            } else {
                probeCommand = `ffmpeg -f cdda -i ${cdDevicePath} -vn -f null -`;
            }

            const probeOutput = await executeFFmpegCommand(probeCommand);
            const trackCount = (probeOutput.match(/Track \d+/g) || []).length;

            console.log(`Found ${trackCount} tracks on the CD.`);

            for (let i = 1; i <= trackCount; i++) {
                await ripSingleTrack(cdDevicePath, outputDirectory, i);
            }
        } else {
            await ripSingleTrack(cdDevicePath, outputDirectory, trackNumber);
        }
    } catch (error) {
        console.error('Error during the ripping/conversion process:', error);
    }
}

async function ripSingleTrack(cdDevicePath, outputDirectory, trackNumber) {
    const outputFilePath = path.join(outputDirectory, `track${trackNumber}.mp3`);

    const command = `ffmpeg -f cdda -t ${trackNumber} -i ${cdDevicePath} -vn -acodec libmp3lame -q:a 2 ${outputFilePath}`;

    console.log(`Ripping track ${trackNumber}...`);

    try {
        const output = await executeFFmpegCommand(command);
        console.log(`Track ${trackNumber} ripped and converted to MP3:`, output);
    } catch (error) {
        console.error(`Error ripping track ${trackNumber}:`, error);
    }
}


const outputDirectory = path.join(__dirname, 'converted');
if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory);
    console.log('Created "converted" directory.');
}

// M4V TO MP4 FUNCTIONS ----------------------------------------------- M4V TO MP4 FUNCTIONS

function convertM4VToMP4(filePath, outputFilePath) {
    ffmpeg(filePath)
        .output(outputFilePath)
        .on('progress', (progress) => {
            const percent = progress.percent.toFixed(2);
            const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
            const quality = progress.quality ? `${progress.quality}` : 'N/A';
            processObj = progress.timemark ? `${progress.timemark}` : 'N/A';
            printLog(filePath, percent, resolution, quality);
        })
        .on('end', () => {
            console.log(`Conversion completed: ${outputFilePath}`);
            fileCount++;
            if (fileCount === totalFiles) {
                console.log('All files have been converted.');
                openExplorer(filePath);
                FFplay(thisAudioFile);
            }
        })
        .on('error', (err) => {
            console.error(`Error during conversion: ${err.message}`);
        })
        .run();
}

function convertm4v(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Failed to read directory: ${err.message}`);
            return;
        }

        const m4vFiles = files.filter(file => path.extname(file).toLowerCase() === '.m4v');
        if (m4vFiles.length === 0) {
            console.log('No .m4v files found in the directory.');
            return;
        }

        totalFiles = m4vFiles.length;
        lastDirectoryName = directory;

        m4vFiles.forEach((file) => {
            const inputFilePath = path.join(directory, file);
            const outputDirectory = path.join(directory, 'Converted');

            if (!fs.existsSync(outputDirectory)) {
                fs.mkdirSync(outputDirectory);
            }
            const outputFilePath = path.join(outputDirectory, path.basename(file, '.m4v') + '.mp4');

            console.log(`Converting: ${inputFilePath} to ${outputFilePath}`);
            convertM4VToMP4(inputFilePath, outputFilePath);
        });
    });
}

// VOB to MP4 FUNCTIONS ----------------------------------------------- VOB to MP4 FUNCTION

async function convertVOBtoMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const vobFiles = files.filter(file => path.extname(file).toLowerCase() === '.vob');
            totalFiles = vobFiles.length;

            for (const file of vobFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.vob')}.mp4`);
                try {
                    await startVOBtoMP4(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.vob') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await startVOBtoMP4(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not a VOB file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

async function startVOBtoMP4(inputPath, outputPath) {
    try {
        const ffmpeg = require('fluent-ffmpeg');
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .output(outputPath)
                .format('mp4')
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log(`Conversion successful: ${inputPath} -> ${outputPath}`);
    } catch (err) {
        console.error(`Error during conversion of ${inputPath}:`, err);
        throw err;
    }
}

// AVI to MP4 FUNCTIONS ----------------------------------------------- AVI to MP4 FUNCTIONS

function convertAVIToMP4(filePath, outputFilePath, callback) {
    ffmpeg(filePath)
        .output(outputFilePath)
        .on('progress', (progress) => {
            const percent = progress.percent.toFixed(2);
            const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
            const quality = progress.quality ? `${progress.quality}` : 'N/A';
            processObj = progress.timemark ? `${progress.timemark}` : 'N/A';
            printLog(filePath, percent, resolution, quality);
        })
        .on('end', () => {
            console.log(`Conversion completed: ${outputFilePath}`);
            fileCount++;
            if (fileCount === totalFiles) {
                console.log('All files have been converted.');
                openExplorer(filePath);
                FFplay(thisAudioFile);
            }

            callback();
        })
        .on('error', (err) => {
            console.error(`Error during conversion: ${err.message}`);
            callback();
        })
        .run();
}


function convertAvi(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Failed to read directory: ${err.message}`);
            return;
        }

        const aviFiles = files.filter(file => path.extname(file).toLowerCase() === '.avi');
        if (aviFiles.length === 0) {
            console.log('No .avi files found in the directory.');
            return;
        }

        totalFiles = aviFiles.length;
        lastDirectoryName = directory;

        function processNextFile(index) {
            if (index >= aviFiles.length) {
                console.log('All files have been processed.');
                return;
            }

            const file = aviFiles[index];
            const inputFilePath = path.join(directory, file);
            const outputDirectory = path.join(directory, 'Converted');

            if (!fs.existsSync(outputDirectory)) {
                fs.mkdirSync(outputDirectory);
            }
            const outputFilePath = path.join(outputDirectory, path.basename(file, '.avi') + '.mp4');

            console.log(`Converting: ${inputFilePath} to ${outputFilePath}`);
            convertAVIToMP4(inputFilePath, outputFilePath, () => {
                processNextFile(index + 1);
            });
        }

        processNextFile(0);
    });
}


// MP3 to WAV FUNCTIONS ----------------------------------------------- MP3 to WAV FUNCTIONS

function convertMP3ToWAV(directory) {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Failed to read directory: ${err.message}`);
            return;
        }

        const mp3Files = files.filter(file => path.extname(file).toLowerCase() === '.mp3');
        if (mp3Files.length === 0) {
            console.log('No .mp3 files found in the directory.');
            return;
        }

        totalFiles = mp3Files.length;
        lastDirectoryName = directory;

        function processNextFile(index) {
            if (index >= mp3Files.length) {
                console.log('All files have been processed.');
                return;
            }

            const file = mp3Files[index];
            const inputFilePath = path.join(directory, file);
            const outputDirectory = path.join(directory, 'Converted');

            if (!fs.existsSync(outputDirectory)) {
                fs.mkdirSync(outputDirectory);
            }
            const outputFilePath = path.join(outputDirectory, path.basename(file, '.mp3') + '.wav');

            console.log(`Converting: ${inputFilePath}`);
            convertMP3(inputFilePath, outputFilePath, () => {
                processNextFile(index + 1);
            });
        }

        processNextFile(0);
    });
}
function convertMP3(filePath, outputFilePath, callback) {
    ffmpeg(filePath)
        .output(outputFilePath)
        .on('progress', (progress) => {
            const percent = progress.percent.toFixed(2);
            const duration = progress.timemark ? `${progress.timemark}` : 'N/A';
            console.log(`Progress: ${percent}% | Duration: ${duration}`);
        })
        .on('end', () => {
            console.log(`Conversion completed: ${outputFilePath}`);
            fileCount++;
            if (fileCount === totalFiles) {
                console.log('All files have been converted.');
                openExplorer(filePath);
                FFplay(thisAudioFile);
            }
            callback();
        })
        .on('error', (err) => {
            console.error(`Error during conversion: ${err.message}`);
            callback();
        })
        .run();
}

// MOV to MP4 FUNCTIONS ----------------------------------------------- MOV to MP4 FUNCTIONS

async function convertMOVToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            // lastDirectoryName = path.basename(inputPath);
            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const movFiles = files.filter(file => path.extname(file).toLowerCase() === '.mov');
            totalFiles = movFiles.length;

            for (const file of movFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.mov')}.mp4`);
                try {
                    await MOVtoMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.mov') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await MOVtoMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not a MOV file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function MOVtoMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// 3GP to MP4 FUNCTIONS ----------------------------------------------- 3GP to MP4 FUNCTIONS

async function convert3GPToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const threegpFiles = files.filter(file => path.extname(file).toLowerCase() === '.3gp');
            totalFiles = threegpFiles.length;

            for (const file of threegpFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.3gp')}.mp4`);
                try {
                    await threeGPToMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.3gp') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await threeGPToMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not a 3GP file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function threeGPToMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// FLV to MP4 FUNCTIONS ----------------------------------------------- FLV to MP4 FUNCTIONS

async function convertFLVToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const flvFiles = files.filter(file => path.extname(file).toLowerCase() === '.flv');
            totalFiles = flvFiles.length;

            for (const file of flvFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.flv')}.mp4`);
                try {
                    await flvToMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.flv') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await flvToMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not an FLV file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function flvToMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// MPEG to MP4 FUNCTIONS ----------------------------------------------- MPEG to MP4 FUNCTIONS

async function convertMPEGToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const mpegFiles = files.filter(file => path.extname(file).toLowerCase() === '.mpeg');
            totalFiles = mpegFiles.length;

            for (const file of mpegFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.mpeg')}.mp4`);
                try {
                    await mpegToMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.mpeg') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await mpegToMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not an MPEG file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function mpegToMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// MPG to MP4 FUNCTIONS ----------------------------------------------- MPG to MP4 FUNCTIONS

async function convertMPGToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const mpgFiles = files.filter(file => path.extname(file).toLowerCase() === '.mpg');
            totalFiles = mpgFiles.length;

            for (const file of mpgFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.mpg')}.mp4`);
                try {
                    await mpgToMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.mpg') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await mpgToMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not an MPG file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function mpgToMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// MPG to MP4 FUNCTIONS ----------------------------------------------- MPG to MP4 FUNCTIONS

async function convertWMVToMP4(inputPath) {
    try {
        const stats = await fs.promises.stat(inputPath);

        if (stats.isDirectory()) {
            console.log(`Directory detected: ${inputPath}`);
            const outputDir = path.join(inputPath, 'Converted');
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir);
            }

            lastDirectoryName = inputPath;

            const files = await fs.promises.readdir(inputPath);
            const wmvFiles = files.filter(file => path.extname(file).toLowerCase() === '.wmv');
            totalFiles = wmvFiles.length;

            for (const file of wmvFiles) {
                const filePath = path.join(inputPath, file);
                const outputFile = path.join(outputDir, `${path.basename(file, '.wmv')}.mp4`);
                try {
                    await wmvToMP4Start(filePath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${filePath}:`, err);
                }
            }
            HMDL -= 1;

            if (HMDL === -1) {
                openExplorer(outputDir);
                FFplay(thisAudioFile);
            }

        } else if (stats.isFile()) {
            console.log(`File detected: ${inputPath}`);
            const ext = path.extname(inputPath).toLowerCase();
            if (ext === '.wmv') {
                const outputFile = path.join(path.dirname(inputPath), `${path.basename(inputPath, ext)}.mp4`);
                try {
                    await wmvToMP4Start(inputPath, outputFile);
                } catch (err) {
                    console.error(`Error converting ${inputPath}:`, err);
                }

                openExplorer(path.dirname(inputPath));
                FFplay(thisAudioFile);

            } else {
                console.log('Not a WMV file. Skipping conversion.');
            }
        } else {
            console.log('Input is neither a file nor a directory.');
        }
    } catch (err) {
        console.error('Error processing input:', err);
    }
}

function wmvToMP4Start(inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputFile, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata: ', err);
                console.log('Attempting to re-encode the file to fix potential issues...');

                getVideoDuration(inputFile)
                    .then(duration => {
                        totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                        ffmpeg(inputFile)
                            .outputOptions('-movflags', 'faststart')
                            .output(outputFile)
                            .videoCodec(typeConvCodecVid)
                            .audioCodec(typeConvCodecAud)
                            .on('progress', (progress) => {
                                const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                                processObj = progress.timemark ? progress.timemark : 'N/A';
                                printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                            })
                            .on('end', function () {
                                printLog(inputFile, 100, 'Unknown resolution', 'SD', totalDuration, 'N/A');
                                resolve();
                            })
                            .on('error', function (err) {
                                console.error('Error during re-encoding: ', err);
                                reject(err);
                            })
                            .run();
                    })
                    .catch(err => {
                        console.error('Error fetching video duration: ', err);
                        reject(err);
                    });

                return;
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                console.error('No video stream found in the input file');
                reject(new Error('No video stream found'));
                return;
            }

            const width = videoStream.width;
            const height = videoStream.height;

            const resolutionCategory = getResolutionCategory(width, height);
            const quality = resolutionCategory === 'SD' ? 'Low' : resolutionCategory === 'HD' ? 'Medium' : resolutionCategory === '2K' ? 'High' : 'Very High';

            getVideoDuration(inputFile)
                .then(duration => {
                    totalDuration = duration ? secondsToTimeFormat(duration) : 'N/A';

                    printLog(inputFile, 0, `${width}x${height}`, quality, totalDuration, '00:00:00.00');

                    ffmpeg(inputFile)
                        .outputOptions('-movflags', 'faststart')
                        .output(outputFile)
                        .videoCodec(typeConvCodecVid)
                        .audioCodec(typeConvCodecAud)
                        .videoBitrate(getBitrate(resolutionCategory))
                        .size(`${width}x${height}`)
                        .on('progress', function (progress) {
                            const percent = (progress.percent) ? progress.percent.toFixed(2) : 'N/A';
                            const resolution = `${width}x${height}`;
                            processObj = progress.timemark ? progress.timemark : 'N/A';
                            printLog(inputFile, percent, resolution, quality, totalDuration, processObj);
                        })
                        .on('end', function () {
                            printLog(inputFile, 100, `${width}x${height}`, quality, totalDuration, 'N/A');
                            resolve();
                            fileCount += 1;
                        })
                        .on('error', function (err) {
                            console.error('Error during conversion: ', err);
                            reject(err);
                        })
                        .run();
                })
                .catch(err => {
                    console.error('Error fetching video duration: ', err);
                    reject(err);
                });
        });
    });
}

// VOL INC MP3/WAV/MP4 FUNCTIONS ----------------------------------------------- VOL INC MP3/WAV/MP4 FUNCTIONS

function parseVolumeInput(volumeInput) {
    if (typeof volumeInput === 'string' && volumeInput.endsWith('%')) {
        const percentage = parseFloat(volumeInput.replace('%', ''));
        return percentage / 100;
    }
    return parseFloat(volumeInput);
}

function VOLINCMP3nWAV(filePath, volumeInput = '100%') {
    const cleanedFilePath = filePath.replace(/^['"](.*)['"]$/, '$1');

    const volumeMultiplier = parseVolumeInput(volumeInput);

    ffmpeg.setFfmpegPath(require('ffmpeg-static'));

    const fileDir = path.dirname(cleanedFilePath);
    const fileName = path.basename(cleanedFilePath, path.extname(cleanedFilePath));
    const fileExt = path.extname(cleanedFilePath).toLowerCase();

    const outputFilePath = path.join(fileDir, `${fileName}_1${fileExt}`);

    let process = ffmpeg(cleanedFilePath);

    if (fileExt === '.mp4') {
        process = process.outputOptions('-c:v', 'copy');
    }

    process
        .audioFilters(`volume=${volumeMultiplier}`)
        .on('end', function () {
            console.log(`Volume increase complete. Output saved to ${outputFilePath}`);
        })
        .on('error', function (err) {
            console.error('Error during volume increase:', err);
        })
        .save(outputFilePath);
}

// MOVE MOOV FUNCTIONS ----------------------------------------------- MOVE MOOV FUNCTIONS
async function convertMoov(filePath, outputFilePath) {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .outputOptions('-movflags', 'faststart')
            .on('progress', (progress) => {
                const percent = progress.percent !== undefined ? progress.percent.toFixed(2) : 'N/A';
                const resolution = progress.size ? `${progress.width}x${progress.height}` : 'N/A';
                const quality = progress.quality ? `${progress.quality}` : 'N/A';
                processObj = progress.timemark ? `${progress.timemark}` : 'N/A';
                printLog(filePath, percent, resolution, quality);
            })
            .on('end', () => {
                console.log(`Conversion completed: ${outputFilePath}`);
                fileCount++;
                if (fileCount === totalFiles) {
                    console.log('All files have been converted.');
                    openExplorer(lastDirectoryName);
                    FFplay(thisAudioFile);
                }
                resolve();
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err);
                reject(err);
            })
            .save(outputFilePath);
    });
}

async function convertmoo(directory) {
    console.log("DIR GOT", directory);
    try {
        const files = await fs.promises.readdir(directory);

        const mp4Files = files.filter(file => path.extname(file).toLowerCase() === '.mp4');
        if (mp4Files.length === 0) {
            console.log('No .mp4 files found in the directory.');
            return;
        }

        totalFiles = mp4Files.length;
        lastDirectoryName = directory;

        for (let file of mp4Files) {
            const inputFilePath = path.join(directory, file);
            const tempFilePath = path.join(directory, file + '.temp.mp4');

            console.log(`Converting: ${inputFilePath} to temporary file`);

            try {
                await convertMoov(inputFilePath, tempFilePath);

                console.log(`Conversion completed, renaming temporary file to: ${inputFilePath}`);
                await fs.promises.rename(tempFilePath, inputFilePath);

                console.log(`File replaced successfully: ${inputFilePath}`);
            } catch (err) {
                console.error(`Error during conversion: ${err}`);
                if (fs.existsSync(tempFilePath)) {
                    await fs.promises.unlink(tempFilePath);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to read directory: ${err.message}`);
    }
}

// VIDEO CUT FUNCTIONS ----------------------------------------------- VIDEO CUT FUNCTIONS

function cutVideo(cutinputFile, cutoutputFile, cutstartTime, cutendTime) {
    console.log('Input File:', cutinputFile);
    console.log('Output File:', cutoutputFile);

    const fileDirectory = path.dirname(cutinputFile);

    const command = `ffmpeg -i ${cutinputFile} -ss ${cutstartTime} -to ${cutendTime} -c:v copy -c:a copy ${cutoutputFile}`;

    console.log('FFmpeg command:', command);

    exec(command, (err, stdout, stderr) => {
        if (err) {
            console.error('Error occurred during execution:', err.message);
        } else {
            console.log(chalk.hex('00ff00')('File has been successfully cut!'));
            openExplorer(fileDirectory);
            FFplay(thisAudioFile);
        }
    });
}

// ENTRY POINT ----------------------------------------------- ENTRY POINT

async function processCountSelector(givenConverterCounter) {
    if (givenConverterCounter == 'mkv to mp4') {
        whatFunc += 'mkv to mp4';
        console.log(`- LOG -- SELECTED 'mkv to mp4' -`);
        fileCount = 0;

        async function MKVtoMP4Start() {
            const prompt = inquirer.createPromptModule();
            let MKVPaths = [];

            while (true) {
                const { MKVPath } = await prompt([
                    {
                        type: 'input',
                        name: 'MKVPath',
                        message: chalk.hex('#f01fa0')('Where is the file(s)?: (X)'),
                        choices: '',
                    }
                ]);
                HMDL += 1;

                if (MKVPath.toLowerCase() === 'x') {
                    console.log(`- LOG -- ALL CURRENT PATHS: ${MKVPaths} -`);
                    HMDL -= 2;
                    break;
                }

                MKVPaths.push(MKVPath);
            }

            for (const path of MKVPaths) {
                try {
                    await convertMKVtoMP4(path);
                    console.log(`- LOG -- PROCESSING INPUT... for ${path} -`);
                } catch (err) {
                    console.error('Error processing file:', err);
                }
            }
        }

        MKVtoMP4Start();
    } else if (givenConverterCounter == 'm4v to mp4') {
        whatFunc += 'm4v to mp4';
        console.log(`- LOG -- SELECTED 'm4v to mp4 -`);
        async function M4VtoMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertm4v(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        M4VtoMP4Start();
    } else if (givenConverterCounter == 'avi to mp4') {
        whatFunc += 'avi to mp4';
        console.log(`- LOG -- SELECTED 'avi to mp4 -`);
        async function M4VtoMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertAvi(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        M4VtoMP4Start();
    } else if (givenConverterCounter == 'vob to mp4') {
        whatFunc += 'vob to mp4';
        console.log(`- LOG -- SELECTED 'vob to mp4 -`);
        async function VOBtoMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertVOBtoMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        VOBtoMP4Start();
    } else if (givenConverterCounter == 'cda to mp3') {
        whatFunc += 'cda to mp3';
        console.log(`- LOG -- SELECTED 'cda to mp3 -`);
        async function CDAtoMP3Start() {
            const prompt = inquirer.createPromptModule();

            const { CDAPath, whatTracks } = await prompt([
                {
                    type: 'input',
                    name: 'CDAPath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                },
                {
                    type: 'input',
                    name: 'whatTracks',
                    message: 'Which track? (\'*\' for all tracks):',
                    choices: '',
                }
            ]);

            try {
                await ripCD(CDAPath, 'converted', whatTracks);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        CDAtoMP3Start();
    } else if (givenConverterCounter == 'mp3 to wav') {
        whatFunc += 'mp3 to wav';
        console.log(`- LOG -- SELECTED 'mp3 to wav -`);
        async function MP3TOWAVStart() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertMP3ToWAV(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        MP3TOWAVStart();
    } else if (givenConverterCounter == 'mov to mp4') {
        whatFunc += 'mov to mp4';
        console.log(`- LOG -- SELECTED 'mov to mp4 -`);
        async function MOVTOMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertMOVToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        MOVTOMP4Start();
    } else if (givenConverterCounter == '3gp to mp4') {
        whatFunc += '3gp to mp4';
        console.log(`- LOG -- SELECTED '3gp to mp4 -`);
        async function threeGPToMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convert3GPToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        threeGPToMP4Start();
    } else if (givenConverterCounter == 'flv to mp4') {
        whatFunc += 'flv to mp4';
        console.log(`- LOG -- SELECTED 'flv to mp4 -`);
        async function flvToMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertFLVToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        flvToMP4Start();
    } else if (givenConverterCounter == 'mpeg to mp4') {
        whatFunc += 'mpeg to mp4';
        console.log(`- LOG -- SELECTED 'mpeg to mp4 -`);
        async function mpegToMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertMPEGToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        mpegToMP4Start();
    } else if (givenConverterCounter == 'mpg to mp4') {
        whatFunc += 'mpg to mp4';
        console.log(`- LOG -- SELECTED 'mpg to mp4 -`);
        async function mpgToMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertMPGToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        mpgToMP4Start();
    } else if (givenConverterCounter == 'wmv to mp4') {
        whatFunc += 'wmv to mp4';
        console.log(`- LOG -- SELECTED 'wmv to mp4 -`);
        async function wmvToMP4Start() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertWMVToMP4(thePath);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        wmvToMP4Start();
    } else if (givenConverterCounter == 'vol inc mp3/wav/mp4') {
        whatFunc += 'vol inc mp3/wav/mp4';
        console.log(`- LOG -- SELECTED 'vol inc mp3/wav/mp4 -`);
        async function VOLINCMP3nWAVStart() {
            const prompt = inquirer.createPromptModule();

            const { thePath, howLoud } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f01fa0')('Where is the file?:'),
                    choices: '',
                },
                {
                    type: 'input',
                    name: 'howLoud',
                    message: chalk.hex('#028fa0')('How much louder? :'),
                    choices: '',
                }
            ]);

            try {
                await VOLINCMP3nWAV(thePath, howLoud);
                console.log(chalk.hex('00ff00')('All files have been processed!'));
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        VOLINCMP3nWAVStart();
    } else if (givenConverterCounter == 'move moov') {
        whatFunc = 'move moov';
        console.log(`- LOG -- Selected 'move moov' -`);
        async function moveMoovStart() {
            const prompt = inquirer.createPromptModule();

            const { thePath } = await prompt([
                {
                    type: 'input',
                    name: 'thePath',
                    message: chalk.hex('#f0ffa0')('Where is the file(s)?:'),
                    choices: '',
                }
            ]);

            try {
                await convertmoo(thePath);
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        moveMoovStart();
    } else if (givenConverterCounter == 'cut mp4') {
        whatFunc = 'cut mp4';
        console.log(`- LOG -- Selected 'cut mp4' -`);
        async function cutmp4Start() {
            const prompt = inquirer.createPromptModule();

            const { cutinputFile, cutoutputFile, cutstartTime, cutendTime } = await prompt([
                {
                    type: 'input',
                    name: 'cutinputFile',
                    message: chalk.hex('#f0ffa0')('Where is the main file?:'),
                    choices: '',
                },
                {
                    type: 'input',
                    name: 'cutoutputFile',
                    message: chalk.hex('#f0ffa0')('Where is cut file going to go?:'),
                    choices: '',
                },
                {
                    type: 'input',
                    name: 'cutstartTime',
                    message: chalk.hex('#f0ffa0')('What time (frame) (00h:00m:00s) will be the start?:'),
                    choices: '',
                },
                {
                    type: 'input',
                    name: 'cutendTime',
                    message: chalk.hex('#f0ffa0')('What time (frame) (00h:00m:00s) will be the end?:'),
                    choices: '',
                }
            ]);

            try {
                await cutVideo(cutinputFile, cutoutputFile, cutstartTime, cutendTime);
            } catch (err) {
                console.error('Error processing files:', err);
            }
        }
        cutmp4Start();
    }
}

async function start() {
    const prompt = inquirer.createPromptModule();

    const { whatConverter } = await prompt([
        {
            type: 'list',
            name: 'whatConverter',
            message: 'Which Converter?:',
            choices: ['mkv to mp4', 'm4v to mp4', 'avi to mp4', 'vob to mp4', 'mov to mp4', '3gp to mp4', 'flv to mp4', 'mpeg to mp4', 'mpg to mp4', 'wmv to mp4', 'cda to mp3', 'mp3 to wav', 'vol inc mp3/wav/mp4', 'move moov', 'cut mp4'],
            pageSize: 20,
        }
    ]);

    try {
        await processCountSelector(whatConverter);
    } catch (err) {
        console.error('Error processing files:', err);
    }
}

start();