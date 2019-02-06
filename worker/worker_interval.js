var id = null;
this.onmessage = function(e) {
  switch(e.data.command) {
    case 'set':
      if(id) {
        clearInterval(id);
      }
      id = setInterval(function() {
        id = null;
        postMessage('dummy');
      }, (e.data.delay || 0));
      break;
    case 'clear':
      if(id) {
        clearInterval(id);
        id = null;
      }
      break;
    case 'exit':
      self.close();
      break;
  }
}

