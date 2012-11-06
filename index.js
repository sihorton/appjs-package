module.exports = function packagedAppRouter(root) {
	try {
		var packagedApp = new AdmZip(root);
	} catch(e) {
		throw (e);
		//return function router(request, response, next) { next(); };
	}
	return function router(request, response, next){
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
}