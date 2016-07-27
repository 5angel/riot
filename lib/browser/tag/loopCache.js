import {
  isUndefined,
  isObject,
  defineProperty
} from './../common/util'

const
  tagById = {},
  tagByValue = {}

export function setLink(tag, item) {
  if (isObject(item)) {
    let riotId = tag._riot_id

    tagById[riotId] = tag

    defineProperty(item, '_riot_id', riotId)
  } else {
    if (isUndefined(tagByValue[item]))
      tagByValue[item] = tag
  }
}

export function getLink(item) {
  return isObject(item) ?
    tagById[item._riot_id] :
    tagByValue[item]
}

export function clearLink(item) {
  if (isObject(item)) {
    delete tagById[item._riot_id]
    delete item._riot_id
  } else
    delete tagByValue[item]
}

export function clearAll() {
  for (let id in tagById) {
    delete tagById[id]
  }

  for (let value in tagByValue) {
    delete tagByValue[value]
  }
}

export function listLinks(items) {
  return items.map(getLink)
}