require('./searcher.js')

async function sleep (ms) {
    return new Promise ( resolve => {
        setTimeout(resolve, ms)
    });
}
    
async () => { await sleep(5000); }

require('./viewer.js')
