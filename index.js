
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
				pInfo.readPackageFile = function(filename,callback) {
					fs.readFile(path.resolve(pInfo.path,filename),callback);
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
		} else {
			
			callBack(errTxt,pInfo);
		}
	}
}
module.exports = Me;