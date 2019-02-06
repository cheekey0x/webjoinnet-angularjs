var id = null;
this.onmessage = function(e) {
  switch(e.data.command) {
    case 'set':
      if(id) {
        clearTimeout(id);
      }
      id = setTimeout(function() {
        id = null;
        postMessage('dummy');
      }, (e.data.delay || 0));
      break;
    case 'clear':
      if(id) {
        clearTimeout(id);
        id = null;
      }
      break;
    case 'exit':
      self.close();
      break;
  }
}

