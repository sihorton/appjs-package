
var Me = {
	config: {
		packageExt:'.appjs'
		,modulePackageExt:'.modpack'
		,appInfoFile:'package.json'
		,preferOfficialModules:false
		,moduleDir:__dirname+"/node_modules/"
	},
	getPackageInfo:function(uri, callBack) {
		var path=require('path')
			fs=require('fs')
		;
		var pInfo = {
			path:path.resolve(uri)
		};
		fs.stat(pInfo.path, function(err, stat) {
			if(err) return callBack(err,pInfo);
			var errTxt = '';
			if (stat.isDirectory()) {
				pInfo.isPackage = false;
			}
			if (stat.isFile()) {
				switch(path.extname(pInfo.path||'')) {
					case Me.config.packageExt:
						pInfo.isPackage = true;
					break;
					default:
						pInfo.isPackage = false;
					break;
				}
			}
			if (pInfo.isPackage) {
				var mime = require('mime'),
				AdmZip = require('adm-zip');
				var packagedApp = new AdmZip(pInfo.path);
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
				/*pInfo.readPackageFile = function(filename,callback) {
					fs.readFile(path.resolve(pInfo.path,filename),callback);
				}*/
				pInfo.readPackageFile = function(file,callback) {
					pInfo._package.readFileAsync(file,function(buffer,err) {
						callback(err,buffer);
					});
				}
				pInfo._package = packagedApp;
				Me.checkDependancies(pInfo, callBack);
			} else {
				callBack(errTxt,pInfo);
			}
		});
	},checkDependancies:function(pInfo, callBack) {
		if (pInfo._package.getEntry(Me.config.appInfoFile)) {
			//package.json contains dependancies.
			console.log('reading app package.json');
			console.log(pInfo);
			pInfo.readPackageFile(Me.config.appInfoFile,function(err,buffer) {
				if(err) {
					pInfo.errorTxt = "Error opening application package.json file";
					callBack(err, pInfo);
					return;
				}
				var platformInfo = {};
				appInfo = JSON.parse(buffer.toString());
				for(var i in appInfo) {
					pInfo[i] = appInfo[i];
				}
				callBack('',pInfo);
				console.log("\nchecking dependancies:"+pInfo['name']+" v"+pInfo['version']);
				/*
				//read platform dependancies...
				fs.exists(__dirname+"/"+config.appInfoFile,function(exists) {
					if (!exists) {
						//no local dependancies...
						console.log("no local dependancies found.");
					} else {
						fs.readFile(__dirname+"/"+config.appInfoFile, 'utf8', function (err,data) {
						  if (err) {
							console.log(err);
						  } else {
							platformInfo = JSON.parse(data);
							//perform a comparison.
							var missing = [];
							for(var i in appInfo.appdeps) {
									var aDep = appInfo.appdeps[i];
									if (platformInfo.appdeps[i]) {
										pDep = platformInfo.appdeps[i];
										if (upgradeNeeded(aDep.version,pDep.version)) {
											console.log("\t>"+aDep.name+" v"+aDep.version + " ("+pDep.version+")");
											missing.push(aDep);
										} else {
											console.log("\t+"+aDep.name+" v"+aDep.version);
										}
									} else {
										console.log("\t-"+aDep.name+" v"+aDep.version);
										missing.push(aDep);
									}
								}
							}
							if (missing.length==0) {
								callback(undefined,missing);
							} else {
								downloadModules(missing,appInfo,platformInfo,function(err,downloaded) {
									var downloadModulesErr = "";
									if (err) {
										//there was an error downloading the modules.
										downloadModulesErr = err;
									} else {
										//console.log("required modules downloaded");
									}
									var updating = 0;
									for(var m=downloaded.length-1;m>-1;m--) {
										updating++;
										fs.readFile(config.moduleDir+downloaded[m].name+"/package.json", 'utf8', function (err,data) {
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
													fs.writeFile(__dirname+"/"+config.appInfoFile,JSON.stringify(platformInfo, null,4),function(err) {
														if (err) {
															callback(err,missing);
														} else {
															callback(downloadModulesErr,missing);
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
				});*/

			});
			
		} else {
			
			callBack(errTxt,pInfo);
		}
	}
}
module.exports = Me;