
var Me = {
	config: {
		packageExt:'.appjs'
		,modulePackageExt:'.modpack'
		,appInfoFile:'package.json'
		,preferOfficialModules:false
		,moduleDir:__dirname+"/node_modules/"
	},
	path:null
	,getPackageInfo:function(uri, callBack) {
		var path=require('path')
			fs=require('fs')
		;
		var pInfo = {
			path:path.resolve(uri)
		};
		fs.stat(pInfo.path, function(err, stat) {
			if(err) return callBack(err,pInfo);
			console.log("stat ok");
			//is it a package.
			if (stat.isDirectory()) {
				pInfo.isPackage = false;
			}
			if (stat.isFile()) {
				var ext = path.extname(pInfo.path||'');
				
				console.log("file ext=",ext);
				switch(path.extname(pInfo.path||'')) {
					case '.appjs':
						pInfo.isPackage = true;
					break;
					default:
						pInfo.isPackage = false;
					break;
				}
			}
			callBack(null,pInfo);
		});
	}
}
module.exports = Me;