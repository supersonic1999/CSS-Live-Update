function addStylesheet(fileName) {
	var head = document.head;
	var link = document.createElement("link");

	link.type = "text/css";
	link.rel = "stylesheet";
	link.href = fileName + "?now=" + new Date() * 1;

	head.appendChild(link);
	links.push(link);
}
function removeStylesheet(sheet) {
	try {
		document.querySelector('link[href*="'+sheet+'"]').remove();
	}
	catch(e) {
		console.log("Error removing stylesheet: "+sheet);
	}
}

//https://livejs.com/
var headers = { "Etag": 1, "Last-Modified": 1, "Content-Length": 1, "Content-Type": 1 },
resources = {},
pendingRequests = {},
currentLinkElements = {},
oldLinkElements = {},
interval = 500,
loaded = false,
links = [];


var Live = {
        // performs a cycle per interval
        heartbeat: function () {
        if (document.body) {
                // make sure all resources are loaded on first activation
                if (!loaded) Live.loadresources();
                Live.checkForChanges();
        }
        setTimeout(Live.heartbeat, interval);
        },

        // loads all local css and js resources upon first activation
        loadresources: function () {
                // gather all resources
                var uris = [];

                // track local css urls
                for (var i = 0; i < links.length; i++) {
                        var link = links[i], rel = link.getAttribute("rel"), href = link.getAttribute("href", 2);

                        if (href && rel && rel.match(new RegExp("stylesheet", "i"))) {
                                uris.push(href);
                                currentLinkElements[href] = link;
                        }
                }

                // initialize the reso urces info
                for (i = 0; i < uris.length; i++) {
                        var url = uris[i];
                        Live.getHead(url, function (url, info) {
                                resources[url] = info;
                        });
                }

                // add rule for morphing between old and new css files
                var head = document.getElementsByTagName("head")[0],
                style = document.createElement("style"),
                rule = "transition: all .3s ease-out;",
                css = [".livejs-loading * { ", rule, " -webkit-", rule, "-moz-", rule, "-o-", rule, "}"].join('');
                style.setAttribute("type", "text/css");
                head.appendChild(style);
                style.styleSheet ? style.styleSheet.cssText = css : style.appendChild(document.createTextNode(css));

                // yep
                loaded = true;
        },

        // check all tracking resources for changes
        checkForChanges: function () {
                for (var url in resources) {
                        if (pendingRequests[url])
                        continue;

                        Live.getHead(url, function (url, newInfo) {
                                var oldInfo = resources[url],
                                hasChanged = false;
                                resources[url] = newInfo;
                                for (var header in oldInfo) {
                                        // do verification based on the header type
                                        var oldValue = oldInfo[header],
                                        newValue = newInfo[header],
                                        contentType = newInfo["Content-Type"];
                                        switch (header.toLowerCase()) {
                                                case "etag":
                                                if (!newValue) break;
                                                // fall through to default
                                                default:
                                                hasChanged = oldValue != newValue;
                                                break;
                                        }
                                        // if changed, act
                                        if (hasChanged) {
                                                console.log("changed");
                                                Live.refreshResource(url, contentType);
                                                break;
                                        }
                                }
                        });
                }
        },

        // act upon a changed url of certain content type
        refreshResource: function (url, type) {
                switch (type.toLowerCase()) {
                        // css files can be reloaded dynamically by replacing the link element
                        case "text/css":
                                var link = currentLinkElements[url],
                                html = document.body.parentNode,
                                head = link.parentNode,
                                next = link.nextSibling,
                                newLink = document.createElement("link");

                                link.disabled = true;
                                html.className = html.className.replace(/\s*livejs\-loading/gi, '') + ' livejs-loading';
                                newLink.setAttribute("type", "text/css");
                                newLink.setAttribute("rel", "stylesheet");
                                newLink.setAttribute("href", url + "?now=" + new Date() * 1);
                                next ? head.insertBefore(newLink, next) : head.appendChild(newLink);
                                currentLinkElements[url] = newLink;
                                oldLinkElements[url] = link;

                                // schedule removal of the old link
                                Live.removeoldLinkElements();
                                break;

                        // check if an html resource is our current url, then reload
                        case "text/html":
                                if (url != document.location.href)
                return;

                        // local javascript changes cause a reload as well
                        case "text/javascript":
                        case "application/javascript":
                        case "application/x-javascript":
                                document.location.reload();
                }
        },

        // removes the old stylesheet rules only once the new one has finished loading
        removeoldLinkElements: function () {
                var pending = 0;

                for (var url in oldLinkElements) {
                        // if this sheet has any cssRules, delete the old link
                        try {
                                var link = currentLinkElements[url],
                                oldLink = oldLinkElements[url],
                                html = document.body.parentNode,
                                sheet = link.sheet || link.styleSheet;
                                //rules = sheet.rules || sheet.cssRules;
                                //if (rules.length >= 0) {
                                oldLink.parentNode.removeChild(oldLink);
                                delete oldLinkElements[url];
                                setTimeout(function () {
                                        html.className = html.className.replace(/\s*livejs\-loading/gi, '');
                                }, 100);
                                //}
                        } catch (e) {
                                pending++;
                                console.log("1235", e);
                        }
                        if (pending) setTimeout(Live.removeoldLinkElements, 50);
                }
        },

        // performs a HEAD request and passes the header info to the given callback
        getHead: function (url, callback) {
                pendingRequests[url] = true;
                var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XmlHttp");
                xhr.open("HEAD", url, true);
                xhr.onreadystatechange = function () {
                        delete pendingRequests[url];
                        if (xhr.readyState == 4 && xhr.status != 304) {
                                xhr.getAllResponseHeaders();
                                var info = {};
                                for (var h in headers) {
                                        var value = xhr.getResponseHeader(h);
                                        // adjust the simple Etag variant to match on its significant part
                                        if (h.toLowerCase() == "etag" && value) value = value.replace(/^W\//, '');
                                                if (h.toLowerCase() == "content-type" && value) value = value.replace(/^(.*?);.*?$/i, "$1");
                                                info[h] = value;
                                        }
                                        callback(url, info);
                                }
                        }
                        xhr.send();
        }
};