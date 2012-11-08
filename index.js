var  AdmZip = require(__dirname+'/node_modules/adm-zip/adm-zip.js')
	request = require('request')
;
			
var Me = {
	config: {
		packageExt:'.appjs'
		,modulePackageExt:'.modpack'
		,appInfoFile:'package.json'
		,preferOfficialModules:false
		,moduleDir:__dirname+"/../../node_modules/"
		,platformDir:__dirname+"/../../"
		,gzModules:true
	},
	getPackageInfo:function(uri,callback) {
		console.log("depreciated getPackageInfo called, use getPackageInfo2(uri,app,callback) instead");
		Me.getPackageInfo2(uri, undefined, callback);
	},
	getPackageInfo2:function(uri, app, userCallback) {
		var path=require('path')
			fs=require('fs')
		;
		var callback = function(err,pInfo) {
			//read launch file and pass it back to the caller...
			pInfo.readPackageFile(pInfo.launch,function(err,buffer) {
				
				userCallback(err,pInfo,buffer);
			});
		}
		
		var pInfo = {
			path:path.resolve(uri)
		};
		fs.stat(pInfo.path, function(err, stat) {
			if(err) return callback(err,pInfo);
			var errTxt = '';
			if (stat.isDirectory()) {
				pInfo.isPackage = false;
				pInfo.isDir = true;
				pInfo.launch = pInfo.path+"/app.js";//TODO: this is an assumption get it from package
				if (app) {
					app.serveFilesFrom(pInfo.path + '/content');//TODO: this is an assumption get it from package
				}
				
			}
			if (stat.isFile()) {
				pInfo.isDir = false;
				switch(path.extname(pInfo.path||'')) {
					case Me.config.packageExt:
						pInfo.isPackage = true;
						pInfo.launch = 'app.js';//TODO: this is an assumption get it from package
						pInfo.launchDir = path.dirname(pInfo.path);
					break;
					default:
						pInfo.isPackage = false;
						pInfo.launch = pInfo.path;
						pInfo.launchDir = path.dirname(pInfo.launch);
					break;
				}
			}
			
			if (pInfo.isPackage) {
				var mime = require('mime')
				;
				var packagedApp = new AdmZip(pInfo.path);
				//we could skip storing this on the pInfo object.
				pInfo.router = function router(request, response, next){
					if (request.method === 'get') {
						var url = request.pathname === '/' ? '/index.html' : request.pathname;
						if (packagedApp && packagedApp.getEntry('content/'+url.substring(1))) {
							var mimetype = mime.lookup(url);
							packagedApp.readFileAsync('content/'+url.substring(1),function(buffer,err) {
								if (err) {
									response.send(500,'text/plain',new Buffer("500: Internal Server Error\n"+err, "utf-8"));
								} else {
									response.send(200,mimetype,buffer);
								}
							});		
						} else {
							next();
						}
					} else {
						next();
					}
				};
				pInfo.readPackageFile = function(file,callback) {
					pInfo._package.readFileAsync(file,function(buffer,err) {
						callback(err,buffer);
					});
				}
				pInfo.prepareIcons = function(iconList,callback) {
					var cacheDir = __dirname+path.sep+'..'+path.sep+'temp'+path.sep;
					fs.exists(cacheDir,function(exists) {
						if (!exists) fs.mkdirSync(cacheDir);
						var list = {};
						var waiting = 0;
						var cache = function(myFile) {
							waiting++;
							fs.readFile(__dirname+"/"+myFile,'binary',function(err,buffer) {
								if (err) console.log(err);
								var crypto = require('crypto')
							  , shasum = crypto.createHash('sha1');
								shasum.update(buffer);
								var cfile = shasum.digest('hex').toString() + path.extname(myFile);
								fs.exists(cacheDir+cfile,function(exists) {
									if (!exists) {
										fs.writeFile(cacheDir+cfile, buffer, function(err) {
											if(err) console.log(err);
											//fix for windows.
											list[myFile] = cacheDir+cfile.split("/").join(path.sep);
											if(--waiting ==0) {
												callback('',list);
											}
										}); 
									} else {
										//fix for windows.
										list[myFile] = cacheDir+cfile.split("/").join(path.sep);
										if(--waiting ==0) {
											callback('',list);
										}
									}
								});
							});
						}
						for(var i=0;i<iconList.length;i++) {
							cache(iconList[i]);
						}
					});
				}
				//write to pInfo just for backwards compatability.
				if (app) {
					app.router.use(pInfo.router);
					app.readPackageFile = pInfo.readPackageFile;
					app.prepareIcons = pInfo.prepareIcons;
				}
				pInfo._package = packagedApp;
				Me.checkDependancies(pInfo, callback);
			} else {
				//write to pInfo just for backwards compatability.
				pInfo.readPackageFile = function(filename,callback) {
					fs.readFile(path.resolve(pInfo.path,filename),callback);
				}
				pInfo.prepareIcons = function(iconList,callback) {
					var list = {};
					for(var i=0;i<iconList.length;i++) {
						list[iconList[i]] = __dirname+path.sep+iconList[i];
					}
					callback('', list);
				}
				if (app) {
					app.readPackageFile = pInfo.readPackageFile;
					app.prepareIcons = pInfo.prepareIcons;
				}
				callback(errTxt,pInfo);
			}
		});
	},checkDependancies:function(pInfo, callback) {
		if (pInfo._package.getEntry(Me.config.appInfoFile)) {
			//package.json contains dependancies.
			pInfo.readPackageFile(Me.config.appInfoFile,function(err,buffer) {
				if(err) {
					pInfo.errorTxt = "Error opening application package.json file";
					callback(err, pInfo);
					return;
				}
				var platformInfo = {};
				appInfo = JSON.parse(buffer.toString());
				for(var i in appInfo) {
					pInfo[i] = appInfo[i];
				}
				pInfo['missing'] = [];
				//read platform dependancies...
				fs.exists(Me.config.platformDir+Me.config.appInfoFile,function(exists) {
					if (!exists) {
						console.log("platform package.json not found:"+Me.config.platformDir+Me.config.appInfoFile);
						pInfo['missing'] = [];
					} else {
						fs.readFile(Me.config.platformDir+Me.config.appInfoFile, 'utf8', function (err,data) {
						  if (err) {
							//error loading platform package info.
							console.log(err);
						} else {
							console.log("\nchecking dependancies for "+appInfo['name']+" v"+appInfo['version']);
							platformInfo = JSON.parse(data);
							//perform a comparison.
							pInfo.missing = [];
							for(var i in appInfo.appdeps) {
									var aDep = appInfo.appdeps[i];
									if (platformInfo.appdeps[i]) {
										pDep = platformInfo.appdeps[i];
										if (Me.upgradeNeeded(aDep.version,pDep.version)) {
											console.log("\t>"+aDep.name+" v"+aDep.version + " ("+pDep.version+")");
											pInfo.missing.push(aDep);
										} else {
											console.log("\t+"+aDep.name+" v"+aDep.version);
										}
									} else {
										console.log("\t-"+aDep.name+" v"+aDep.version);
										pInfo.missing.push(aDep);
									}
								}
							}
							if (pInfo.missing.length==0) {
								callback('',pInfo);
							} else {
								//callback('',pInfo);			
								Me.downloadModules(pInfo,platformInfo,function(err,pInfo) {
									var downloadModulesErr = "";
									if (err) {
										//there was an error downloading the modules.
										downloadModulesErr = err;
									} else {
										//console.log("required modules pInfo.missing");
									}
									var updating = 0;
									for(var m=pInfo.missing.length-1;m>-1;m--) {
										updating++;
										fs.readFile(Me.config.moduleDir+pInfo.missing[m].name+"/package.json", 'utf8', function (err,data) {
											if (err) {
												console.log("\tinstall failed:",err);
											} else {
												var modPackageInfo = JSON.parse(data);
												  if (!platformInfo.appdeps[modPackageInfo.name]) platformInfo.appdeps[modPackageInfo.name] = {};
												  
												  platformInfo.appdeps[modPackageInfo.name].name = modPackageInfo.name;
												  platformInfo.appdeps[modPackageInfo.name].version = modPackageInfo.version;
												  if (!platformInfo.appdeps[modPackageInfo.name]['platforms']) platformInfo.appdeps[modPackageInfo.name].platforms = {};
												  platformInfo.appdeps[modPackageInfo.name].platforms[process.platform] = process.platform;
												console.log("\tinstalled:"+modPackageInfo.name);
												  if (--updating<1) {
													//modules downloaded and platform info updated.
													fs.writeFile(Me.config.platformDir+Me.config.appInfoFile,JSON.stringify(platformInfo, null,4),function(err) {
														if (err) {
															callback(err,pInfo);
														} else {
															callback(downloadModulesErr,pInfo);
														}
													});
												  }
											}
										});
									}
								});
							}
						});
					}
				});

			});
			
		} else {
			
			callback(errTxt,pInfo);
		}
	}/**
	* Compare requested version number against installed version number
	* and return true if an upgrade is needed.
	* UpgradeNeeded("0.3.2345.5","0.3")=>true
	* UpgradeNeeded("0.3.2345.5","0.3.2345")=>true
	* UpgradeNeeded("0.3.2345.5","0.3.2345.5")=>false
	* UpgradeNeeded("0.3.2345.5","0.4")=>false
	*/
	,upgradeNeeded:function(requested,installed) {
		var req = requested.replace("v","").split(".");
		var got = installed.replace("v","").split(".");
		var diff = req.length - got.length;
		if (diff > 0) {
			for(var i = diff;diff>0;diff--) {
				got.push(0);
			}
		} else {
			for(var i = diff;diff<0;diff++) {
				req.push(0);
			}
		}
		for(var p=0;p<req.length;p++) {
			if (req[p] == "x") return false;
			var r = parseFloat(req[p]);
			var g = parseFloat(got[p]);
			if (r > g) return true;
			if (r < g) return false;
			//if equal compare next figure
		}
		return false;
	},downloadModules:function(pInfo,platformInfo,callback) {
		var req1 = pInfo.moduleUrl;
		var req2 = platformInfo.moduleUrl;
		if (Me.config.preferOfficialModules) {
			req1 = platformInfo.moduleUrl;
			req2 = pInfo.moduleUrl;
		}
		//try to download module from offical sources first..
		console.log("\n"+pInfo.missing.length+" required module(s) are missing, attempting to download and install.");
		var downloading = 0;
		var downloadingErrorText = "";
		for(var i=pInfo.missing.length-1;i>-1;i--) {
			var aDep = pInfo.missing[i];
			downloading++;
			//console.log(aDep);
			var file;
			if (aDep['crossPlatform']) {
				file = aDep.name+"-"+aDep.version+config.modulePackageExt;
			} else {
				file = aDep.name+"-"+aDep.version+"-"+process.platform+Me.config.modulePackageExt;
			}
			var myCallBack = callback;
			Me.getModuleFile(file,req1+file,req2+file,aDep,function(err,file,aDep) {
				if (err) {
					console.log("\t"+err.message+":"+file);
					downloadingErrorText = "failed to install required packages";
				} else {
					//file is downloaded try to detect if it is correct and unpack.
					try {
						var module = new AdmZip(Me.config.moduleDir+file);
						module.extractAllTo(Me.config.moduleDir+aDep.name, /*overwrite*/true);
						console.log("\textracted:"+file);
						//extractAllTo is a synchronous operation!
						fs.unlink(Me.config.moduleDir+file,function(err) {
							if (err) {
								console.log(err);
							}
						});
					} catch(e) {
						console.log("\t!failed to extract:"+file);
						downloadingErrorText = "failed to install required packages";
					}
				}
				if (--downloading<1) {
					pInfo.downloading = downloading;
					myCallBack(downloadingErrorText,pInfo);
				}
			});
		}
	},getModuleFile:function(file,uri,fallbackUri,aDep,callback) {
	
		var o;
		if (Me.config.gzModules) {
			o = fs.createWriteStream(Me.config.moduleDir+file+'.gz');
		} else {
			o = fs.createWriteStream(Me.config.moduleDir+file);
		}
		o.cancel = false;
		o.on('error',function(err) {
			console.log("Error unable to write module file",err);
			callback(err,file,aDep);
		});
		o.on('close',function(err) {
			if (!this.cancel) {
				if (Me.config.gzModules) {
					//decompress the module...
					console.log("\tdownloaded: ",file+'.gz');
					var zlib = require('zlib');
					var gzip = zlib.createGunzip();
					var inp = fs.createReadStream(Me.config.moduleDir+file+'.gz');
					var out = fs.createWriteStream(Me.config.moduleDir+file);
					out.on('close',function() {
						fs.unlink(file+'.gz');
						console.log("\tdecompressed: ",file+'.gz');
						callback(err,file,aDep);
					}).on('error',function(err) {
						callback(err,file,aDep);
					});
					inp.pipe(gzip).pipe(out);
				} else {
					console.log("\tdownloaded:",file);
					callback(err,file,aDep);
				}
			}
		});
		if (Me.config.gzModules) {
			console.log("\t"+uri+'.gz');
			var r = request(uri+'.gz',function(error,response,body) {
				if (response.statusCode != 200) {
					//file is missing even if download was ok.
					o.cancel = true;
					o.destroy();
					callback(new Error(response.statusCode+' http error'),file,aDep);
				}
			});
		} else {
			console.log("\t"+uri);
			var r = request(uri,function(error,response,body) {
				if (response.statusCode != 200) {
					//file is missing even if download was ok.
					o.cancel = true;
					o.destroy();
					callback(new Error(response.statusCode+' http error'),file,aDep);
				}
			});
		}
		r.on('error',function(err1) {
			o.cancel = true;
			o.destroy();
			fallback(file,uri,fallbackUri,aDep,callback);
			
		}).pipe(o);
		function fallback(file,uri,fallbackUri,aDep,callback) {
			var o2 = fs.createWriteStream(file);
			o2.on('error',function(err) {
				console.log("Error unable to write module file",err);
				callback(err,file,aDep);
			});
			o2.on('close',function(err) {
				callback(err,file,aDep);
			});
			console.log("\ttrying:"+fallbackUri);
			request(fallbackUri,function(error,response,body) {
				if (response.statusCode != 200) {
					//file is missing even if download was ok.
					o.cancel = true;
					o.destroy();
					fallback(file,uri,fallbackUri,aDep,callback);
				}
			})
			.on('error',function(err2) {
				console.log("error",err2.code);
				callback(err2,file,aDep);
			}).pipe(o2);
		}
		
	},launch:function(pInfo, app) {
		pInfo.readPackageFile(pInfo.launch,function(err,buffer) {
			var path = require('path');
			app.readPackageFile = pInfo.readPackageFile;
			if (pInfo.isDir) {
				app.serveFilesFrom(pInfo.path + '/content');
			}
			if (err) {
				console.log("error:",err);
			} else {
				if (typeof iconsDir == "undefined") {
					var iconsDir = __dirname + '/content/icons';
				}
				
				var olddir = __dirname;
				if (pInfo.isPackage) {
					__dirname = path.dirname(pInfo.path);
				} else {
					__dirname = path.dirname(pInfo.launch);
				}
				eval(buffer.toString());
				__dirname = olddir;
			}
		});
	}
}
module.exports = Me;