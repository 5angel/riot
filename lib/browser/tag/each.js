import {
  FIREFOX,
  __TAG_IMPL
} from './../common/global-variables'

import { tmpl } from 'riot-tmpl'
import Tag from './tag'

import * as cache from './loopCache'

import {
  isUndefined,
  isString,
  isObject,
  isSpecialTag,
  getTagName,
  getTagImpl,
  getOuterHTML,
  mkitem,
  getAttr,
  remAttr,
  arrayishAdd,
  arrayishRemove,
  defineProperty,
  isArray,
  makeVirtual,
  moveNestedTags
} from './../common/util'

export default function each(dom, parent, expr) {
  remAttr(dom, 'each')

  const
    noReorder = isString(getAttr(dom, 'no-reorder')),
    child = getTagImpl(dom),
    tagName = getTagName(dom),
    impl = __TAG_IMPL[tagName] || { tmpl: getOuterHTML(dom) },
    useRoot = isSpecialTag(tagName),
    exprObj = tmpl.loopKeys(expr),
    ifExpr = getAttr(dom, 'if'),
    isVirtual = dom.tagName == 'VIRTUAL',
    // #1374 FireFox bug in <option selected={expression}>
    isOptionFF = FIREFOX && tagName.toLowerCase() === 'option'

  let
    root = dom.parentNode,
    mark = document.createTextNode(''),
    hasKeys

  remAttr(dom, 'if')
  remAttr(dom, 'no-reorder')

  // insert a marked where the loop tags will be injected
  root.insertBefore(mark, dom)
  root.removeChild(dom)

  let
    itemsPrevious = [],
    tagsPrevious = []

  const
    tagsMounted = {},
    tagsPending = {}

  exprObj.isLoop = true

  function unmountById(id) {
    let tag = tagsMounted[id]
    tag.unmount()
    arrayishRemove(parent.tags, tagName, tag, true)
    delete tagsMounted[id]
  }

  exprObj.unmount = function unmountEach() {
    for (let id in tagsMounted) {
      unmountById(id)
    }
  }

  console.log('====', tagName, '====')
  exprObj.update = function updateEach() {
    let root = mark.parentNode

    let itemsUpdated = tmpl(exprObj.val, parent)

    // objects cause full redraw
    if (!isArray(itemsUpdated)) {
      hasKeys = itemsUpdated || false
      itemsUpdated = hasKeys
        ? Object
          .keys(itemsUpdated)
          .map(key => {
            return mkitem(exprObj, key, itemsUpdated[key])
          })
        : []
    }

    if (ifExpr) {
      itemsUpdated = itemsUpdated.filter((item, i) => {
        let context = mkitem(exprObj, item, i, parent)
        return tmpl(ifExpr, context)
      })
    }

    console.log('---- LOOP ----')
    console.log('ITMS BEF', itemsPrevious)
    console.log('ITMS AFT', itemsUpdated)
    console.log('HTML BEF', root.innerHTML)

    const tagsUpdated = cache.listLinks(itemsUpdated)

    for (let i; i < itemsUpdated.length; ++i) {
      let raw = itemsUpdated[i]
      let item = !hasKeys && exprObj.key
        ? mkitem(exprObj, raw, i) : raw

      // with "no-order" flag we always use previous tags
      const usePrevious = tagsPrevious.length > i &&
        (noReorder || raw === itemsPrevious[i])

      let tag = usePrevious ? tagsPrevious[i] : tagsUpdated[i]

      if (tag) {
        tag.update(item)

        // non-custom tags should have their nested tags moved as well
        if (!usePrevious && child && tag.tags)
          moveNestedTags(tag, i)
      } else {
        tag = new Tag(impl, {
          parent,
          isLoop: true,
          anonymous: !__TAG_IMPL[tagName],
          root: useRoot ? root : dom.cloneNode(),
          item
        }, dom.innerHTML)

        if (child)
          arrayishAdd(parent.tags, tagName, tag, true)

        // cache parent tag internally
        defineProperty(tag, '_parent', parent)
        // this will be used in events bound to this node
        tag._item = item

        cache.setLink(tag, raw)

        tagsUpdated[i] = tag
        tagsMounted[tag._riot_id] = tag

        tag.mount()
      }

      tagsPending[tag._riot_id] = tag

      const prev = tagsPrevious[i]
      let target = mark

      if (tagsPrevious.length)
        target = isVirtual ? prev._virts[0] : prev.root

      isVirtual ?
        makeVirtual(tag, root, target) :
        root.insertBefore(tag.root, target)
    }

    // unmount redundant
    for (let id in tagsMounted) {
      if (tagsPending.hasOwnProperty(id))
        unmountById(id)
    }

    tagsPrevious = tagsUpdated.slice()
    itemsPrevious = itemsUpdated.slice()

    console.log('HTML AFT', root.innerHTML)

    if (isOptionFF && !root.multiple) {
      for (let i = 0; i < root.length; ++i) {
        if (root[i].__riot1374) {
          root.selectedIndex = i // clear other options
          delete root[i].__riot1374
          break
        }
      }
    }
  }

  return exprObj
}
