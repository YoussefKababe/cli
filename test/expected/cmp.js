riot.tag('component-2', '<div each="{ items }">{ item }</div>', function(opts) {

  this.items = ['bla', 'bla', 'bla']

});
riot.tag('component', '<p>{ opts.msg }</p>', function(opts) {

});