var config = require("./config.json");

const mysql = require('mysql');
const easyvk = require('easyvk');
const fs = require('fs');
const request = require('request');


var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "stories_bot",
  insecureAuth : true
});


con.connect((err) => {
  if (err) throw err;
  console.log("Connected!");
});


let stories = [];
let offset = 0;


const TIME_OUT_STORIES_READ = 1650;

setTimeout(() => { if (config.minutes == 0) return; process.exitCode = 1; }, 60000*config.minutes)

;(async () => {

	let count__errs = 0;

	let vk = await easyvk({
		username: config.username,
		password: config.password,
		reauth: true
	});



	let HttpVK = vk.http;

	await (HttpVK.loginByForm());

 	async function watchStories () {
 		return new Promise((resolve, reject) => {
 			
 			console.log(stories.length + ' [length]');

 			let i = 0;
 			let count__ = 0;

 			function readStories() {
 				
 				if (!stories[i])  {
 					return resolve(count__);
 				}
 				

				HttpVK.readStories(stories[i].vk_id).then(({count}) => {	

					let no_have = false;

					if (count > 0) {
						count__ += 1;
						i++;
					} else {
						no_have = true;
						console.log('No have stories... ' + stories[i].vk_id);
					}



					if (i == stories.length) {
						console.log('ok..');
						return resolve(count__);
					}	

					let page = ['feed', 'photos', 'videos' , 'music'];
					
					page = page[rand(0, page.length - 1)];

					request.get({
						url: 'https://vk.com/' + page,
						jar: HttpVK._authjar
					}, (err, res, vkr) => {

						function req () {


							if (i == stories.length) return resolve(count__);

							con.query('UPDATE `config` SET `value` = "' + stories[i].id + '" WHERE `key` = "last_viewed"', (err) => {
								if (err) throw err;
							});

							let CURRENT_TIMESTAMP = Math.floor(new Date().getTime() / 1000);

							if (!no_have && CURRENT_TIMESTAMP - stories[i].story_published <= 82800) {
								console.log('ok...');
								count__errs = 0;
								return setTimeout(readStories, TIME_OUT_STORIES_READ);
							} else {
								console.log('Empty.. maybe user have a new stories?');
								count__errs += 1;
								
								if (count__errs > 5) {
									console.log('Maybe vk blocked your account for 5 seconds');
									setTimeout(tryGetStories, 10000);
								} else {
									tryGetStories();
								}
							}

							console.log(count__errs + '[errors]');

							function tryGetStories () {
								vk.call('stories.get', {
									owner_id: stories[i].vk_id
								}).then(({vkr}) => {
									
									if (vkr.response.count) {
										
										let 
											k = 0, 
											ss = stories[i].story_published;
											vkr = vkr.response;
										
										while (k < vkr.items[0].length) {
											
											if (vkr.items[0][k].date > ss) {
												ss = vkr.items[0][k].date;
											}

											k = k + 1;
										}
										
										if (stories[i].story_published <= ss) {
											stories[i].story_published = ss;
											
											con.query('UPDATE `users` SET `story_published` = ' + ss + ' WHERE `vk_id` = ' + stories[i].vk_id, (err) => {
												if (err) throw err;
											});
											
											if (!no_have) {
												count__errs = 0;
												console.log('Founed new stories!!' + stories[i].vk_id);
											} else {
												console.log('no.. user haven\'t' + stories[i].vk_id);
												i++;
											}

											setTimeout(readStories, TIME_OUT_STORIES_READ);
										} else {
											console.log('no.. user haven\'t' + stories[i].vk_id);
											i++; //next stories, ignore
											if (no_have) no_have = false;
											return setTimeout(req, 250);
										}


									} else {
										console.log('no.. user haven\'t ' + stories[i].vk_id + '(it\'s true)');
										i++; //next stories, ignore
										if (no_have) no_have = false;
										return setTimeout(req, 250);
									}

								}, (err) => {
									console.log('no.. user haven\'t ' + stories[i].vk_id + ' ('+err+') ');
									i++; //next stories, ignore
									if (no_have) no_have = false;
									return setTimeout(req, 250);
								});
							}
						}

						req();
					})
				});
			}

			readStories();

 		});
 	}


	function main () {
		watchStories().then((count__) => {
			console.log(count__ + '/ 25');
				
			con.query('UPDATE `config` SET `value` = CONVERT(CONVERT(`value`, SIGNED) + '+count__+', CHAR) WHERE `key` = "seen"')

			console.log(stories)

			offset = stories[stories.length - 1].id;

			con.query('SELECT * FROM `users` WHERE UNIX_TIMESTAMP() - `story_published` <= 82800 AND `id` > ' + offset + ' LIMIT 25', (err, res) => {
				console.log(res);
				if (!res[0]) {
					console.log('waiting new stories.... ' + offset);
					setTimeout(main, 2000);
				} else {
					stories = res;
					console.log('Let\'go to new stories!!');
					main();
				}

			});
		});
	}

	function loadConfig () {

		//get last viewed story id
		con.query('SELECT * FROM `config` WHERE `key` = "last_viewed"', (err, res) => {
			
			if (err) throw err;

			offset = Number(res[0].value);

			//then select all stories from table, which more than last viwed
			function loadStories () {
				con.query('SELECT * FROM `users` WHERE UNIX_TIMESTAMP() - `story_published` <= 86400 AND `id` > ' + offset + ' LIMIT 25', (err, res) => {
					stories = res;
					if (stories[0]) return main();

					console.log('empty stories... waiting new stories');
					setTimeout(loadStories, 2000);
				});	
			}

			loadStories();

		});	
	}

	loadConfig();

	function handleDisconnect(connection) {
	// the old one cannot be reused.// process asynchronous requests in the meantime.// If you're also serving http, display a 503 error.
	  connection.on('error', function(err) {
	    console.log('db error', err);
	    if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
	        con = mysql.createConnection({
			  host: "localhost",
			  user: "root",
			  password: "",
			  database: "stories_bot"
			});

			con.connect((err) => {
			  if (err) throw err;
			  console.log("Connected!");
			  loadConfig();
			});

	      handleDisconnect(con);                         // lost due to either server restart, or a
	    } else {                                      // connnection idle timeout (the wait_timeout
	      throw err;                                  // server variable configures this)
	    }
	  });
	}

	handleDisconnect(con);

})();


function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

