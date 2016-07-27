import {
  isUndefined,
  isObject,
  each,
  defineProperty
} from './../common/util'

import Tag from './tag'

export default class LoopCache {
  constructor() {
    this._tagById = {}
    this._tagByValue = {}
  }

  setLink(tag, item) {
    if (isObject(item)) {
      let riotId = tag._riot_id

      this._tagById[riotId] = tag

      defineProperty(item, '_riot_id', riotId)
    } else {
      if (isUndefined(this._tagByValue[item]))
        this._tagByValue[item] = tag
    }
  }

  getLink(item) {
    return isObject(item) ?
      this._tagById[item._riot_id] :
      this._tagByValue[item]
  }

  clearLink(item) {
    let isTag = item instanceof Tag

    if (isObject(item)) {
      delete this._tagById[item._riot_id]

      if (!isTag)
        delete item._riot_id
    } else
      delete this._tagByValue[item]
  }

  clearAll() {
    each(this._tagById, (tag, id) => {
      delete this._tagById[id]
    })

    each(this._tagByValue, (tag, value) => {
      delete this._tagByValue[value]
    })
  }

  listLinks(items) {
    return items.map(this.getLink.bind(this))
  }
}
