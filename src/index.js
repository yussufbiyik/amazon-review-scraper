const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const amazonScraper = require("amazon-buddy")
const CSV = require("@yussufbiyik/simple-csv")

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 850,
    minWidth: 1004,
    minHeight: 650,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "./assets/icons/png/512x512.png"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  
  function formatDate(text) {
    // Define a regular expression pattern to match the date
    const datePattern = /([A-Za-z]+ \d{1,2}, \d{4})/;
    // Search for the date pattern in the text
    const match = text.match(datePattern);
    if (match) {
      // Extract the matched date string
      const dateStr = match[0];
      // Convert the date string to the desired format (year-day-month)
      const months = {
        January: '01',
        February: '02',
        March: '03',
        April: '04',
        May: '05',
        June: '06',
        July: '07',
        August: '08',
        September: '09',
        October: '10',
        November: '11',
        December: '12',
      };
      // Split the date string into its components
      let [month, day, year] = dateStr.split(' ');
      day = day.slice(0, -1).length<2 ? "0"+day.slice(0, -1) : day.slice(0, -1)
      // Format the date as year-day-month
      const formattedDate = `${year}-${months[month]}-${day} 12:00:00 -0400`;
      return formattedDate;
    } else {
      return null;
    }
  }

  async function saveFile(file, name) {
    dialog.showSaveDialog([mainWindow], {
      defaultPath: `${name}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    }).then(({ canceled, filePath }) => {
      if (!canceled && filePath) {
        fs.writeFileSync(filePath, file);
      }
    });
  }

  function formatResults(product, resultData) {
    const formattedResults = []
    resultData.result.forEach(result => {
      const formattedResult = {
        product_handle: product,
        state:"published",
        rating: result.rating,
        title: result.title.slice(18),
        author: result.name,
        email: "wecantsee@email.com",
        location: result.review_data.match(/Reviewed in the (.*) on/)[1],
        body: result.review,
        created_at: formatDate(result.review_data)
      }
      formattedResults.push(formattedResult)
    })
    const formattedResultAsCSV = CSV.stringify(formattedResults, {seperator:",", isSurrounded: true})
    mainWindow.webContents.send("finish-load-animation");
    saveFile(formattedResultAsCSV, product)
    // mainWindow.webContents.send("save-output", formattedResultAsCSV)
  }

  function scrapeReviews(options) {
    amazonScraper.reviews({
      asin:options.product, 
      number:options.reviewCount,
      minStars: options.minStars,
      maxStars: options.maxStars,
      page: options.pageCount
    }).then(resultData => {
      if(options.outputFormat === "raw") {
        const rawResultAsCSV = CSV.stringify(resultData.result, {seperator:",", isSurrounded: true});
        mainWindow.webContents.send("finish-load-animation");
        saveFile(rawResultAsCSV, options.productHandle);
        return
      }
      formatResults(options.productHandle, resultData);
    })
  }

  ipcMain.on("scrape-request", (e, options) => {
    scrapeReviews(options)
  })
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
