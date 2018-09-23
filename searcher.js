var config = require("./config.json");

const easyvk = require('easyvk');
 
var mysql = require('mysql');


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

const PHOTOCACH_TOKEN = '{FIRST_GROUP_TOKEN}';
const GROWNET_TOKEN = '{SECOND_GROUP_TOKEN}';
var MDK__GROUP = config.group_id;
const TIME_OUT = 70; //for one request to API
const SECOND_TIME_OUT = 120; //for second request to API
const RAMIL_ACCESS_TOKEN = '{SECOND_USER_TOKEN}';
//first token need in authentication way: username, password


let offset = 2500000;
let count = 0;
let count_blocked = 0;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

setTimeout(() => { if (config.minutes == 0) return; process.exitCode = 1; }, 60000*config.minutes)

;(async () => {


	easyvk.debuggerRun.on("push", console.log);

	let vk = await easyvk({
		username: config.username,
		password: config.password, //second token for user will be created by authentication
		reauth: true,
		// save_session: true,?
		// session_file: './.session',
		// platform: 'ios'
	});


 	async function getMembersWhoHasStories () {
 			
 		//get members frm groups, from this groups
 		//stories will be read
 		let vkr = await (vk.call('groups.getMembers', {
			count: 100,
			sort: 'id_desc',
			offset: offset,
			group_id: 123695926,
			access_token: [RAMIL_ACCESS_TOKEN, undefined][rand(0,1)],
		}));

		vkr = vkr.vkr.response.items;

		return new Promise((resolve, reject) => {

			let users = vkr;

			offset += 100;

			let k = 0;
			let response = [];

			reqStories = (is_second) => {

				let members = users.slice(k * 25, (k * 25) + 25);
				
				console.log(members.length);

				let params = {
					code: 
					`
					var stories=[];
					var users=${JSON.stringify(members)};
					var i = 0;
					while(i < users.length)
					 { 
					 	var s;
					 	s = API.stories.get({"owner_id": users[i]});
					 	if (s.count) { 
					 		var k = 0; var ss = 0;
					 		while (k < s.items[0].length) {if (s.items[0][k].date > ss) {ss = s.items[0][k].date;} k = k + 1;}
					 		stories.push({vk:users[i],ls:ss});
					 	}
					 	i = i + 1;
					 } return stories;`
				}

				if (is_second) {
					params.access_token = RAMIL_ACCESS_TOKEN;
				}

				//getting only users with stories
				vk.call('execute', params).then(({vkr}) => {

					
					if (vkr.response.length) {
						response = [...response, ...(vkr.response)];
					}

					if (k == 0 || k == 2) {
						//second request from Ramil;
						k++;
						reqStories(true);
					} else if (k == 1){
						setTimeout(() => {
							k++;
							reqStories();
						}, SECOND_TIME_OUT);
					} else {
						resolve(response);
					}


				}, (error) => {
					console.log(error);
				});

			}

			reqStories();


		});
	}


	function main () {
		getMembersWhoHasStories().then((users) => {
			if (users.length) {
				
				//Have, need add to database
				setTimeout(main, TIME_OUT);

				for (let i = 0; i < users.length; i++) {
					let user = users[i];
					con.query('SELECT * FROM `users` WHERE `vk_id` = ' + user.vk, (err, res) => {

						if (!res.length) {
							count += 1;
							con.query('INSERT INTO `users` (`vk_id`,`story_published`) VALUES ('+ user.vk +', '+ user.ls +')', (err) => {
								if (err) throw err;
							});
						} else {
							count_blocked += 1;
							console.log('User already haved ' + count_blocked)
						}
					});
				}

				console.log(count, 'count of users / have(s)');

			} else {
				setTimeout(main, TIME_OUT);
			}

			con.query('UPDATE `config` SET `value` = "'+ offset +'" WHERE `key` = "offset"', (err) => {
				if (err) throw err;
			});

		});
	}

	function loadConfig () {

		//get configuration, offset - is latest offset which was used by script
		con.query('SELECT `value` FROM `config` WHERE `key` = "offset"', (err, res) => {
			
			offset = Number(res[0].value);
			con.query('SELECT COUNT(`id`) AS `count` FROM `users`', (err, res) => {
				count = Number(res[0].count);
				main();
			});	

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
