let hasBeenExtended = false;

module.exports = function(mongoose, cache) {
  let aggregate = mongoose.Model.aggregate;

  mongoose.Model.aggregate = function() {
    let res = aggregate.apply(this, arguments);

    if (!hasBeenExtended && res.constructor && res.constructor.name === 'Aggregate') {
      extend(res.constructor);
      hasBeenExtended = true;
    }

    return res;
  };

  function extend(Aggregate) {
    let exec = Aggregate.prototype.exec;

    Aggregate.prototype.exec = function(callback) {
      let key     = this.getCacheKey()
        , ttl     = this._ttl
        , promise = new mongoose.Promise()
        ;

      promise.onResolve(callback);

      cache.get(key, (err, cachedResults) => {
        if (cachedResults) {
          cachedResults._fromCache = true;
          promise.resolve(null, cachedResults);
        } else {
          exec.call(this).onResolve((err, results) => {
            if (err) return promise.resolve(err);
            cache.set(key, results, ttl, () => {
              promise.resolve(null, results);
            });
          });
        }
      });

      return promise;
    };

    Aggregate.prototype.cache = function(ttl = 60, customKey = '') {
      if (typeof ttl === 'string') {
        customKey = ttl;
        ttl = 60;
      }

      this._ttl = ttl;
      this._key = customKey;
      return this;
    };

    Aggregate.prototype.getCacheKey = function() {
      return JSON.stringify(this._pipeline);
    };
  }
};
