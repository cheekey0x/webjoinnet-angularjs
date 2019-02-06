//self.CACHE_NAME = 'hmtg-webjoinnet-cache-1.0.0.8d';

self.addEventListener('install', function(event) {
  /*
  event.waitUntil(
    caches.open(self.CACHE_NAME)
      .then(function(cache) {
        return cache.addAll([]);
      })
  );
  */
});

self.addEventListener('activate', function(event) {
  self.clients.matchAll().then(function(clientList) {
    if(clientList) {
      for(var i = 0; i < clientList.length; i++) {
        client = clientList[i];
        client.postMessage({
          cmd: 'client_id', data: clientList[0].id
        });
      }
    }
  });

  /*
  var cacheWhitelist = [];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  */
});

self.addEventListener('message', function(event) {
  if(event.data) {
    switch(event.data.cmd) {
      case 'client_id':
        event.source.postMessage({ cmd: 'client_id', data: event.source.id });
        break;
      default:
        break;
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var client_id = '';
  if(event.notification.data && event.notification.data.client_id) {
    client_id = event.notification.data.client_id;
  }

  var url = '';
  if(event.notification.data && event.notification.data.url) {
    url = event.notification.data.url;
  }

  // This looks to see if the current is already open and
  // focuses if it is
  event.waitUntil(clients.matchAll({
    type: "window"
  }).then(function(clientList) {
    //if (event.action === 'archive') 
    if(clientList) {
      var client = null;
      for(var i = 0; i < clientList.length; i++) {
        client = clientList[i];
        if(client_id && client.id == client_id) {
          //client.postMessage({ cmd: 'notificationclick', data: data });
          return client.focus();
        }
      }
    }
	if(url) {
	  clients.openWindow(url);
	}
  }));
});

/*
self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).then(function(response) {
    // Cache hit - return response
    if(response) {
      console.log('hit cache, type: ' + response.type + ', url=' + response.url);
      return response;
    }
    // IMPORTANT: Clone the request. A request is a stream and
    // can only be consumed once. Since we are consuming this
    // once by cache and once by the browser for fetch, we need
    // to clone the response.
    var fetchRequest = event.request.clone();

    return fetch(fetchRequest).then(
      function(response) {
        // Check if we received a valid response
        if(!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // IMPORTANT: Clone the response. A response is a stream
        // and because we want the browser to consume the response
        // as well as the cache consuming the response, we need
        // to clone it so we have two streams.
        var responseToCache = response.clone();

        caches.open(self.CACHE_NAME)
          .then(function(cache) {
            cache.put(event.request, responseToCache);
            console.log('added to cache, type: ' + response.type + ', url=' + response.url);
          });

        return response;
      });
    }));
});
*/
