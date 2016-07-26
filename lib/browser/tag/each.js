import {
  FIREFOX,
  __TAG_IMPL
} from './../common/global-variables'

import { tmpl } from 'riot-tmpl'
import Tag from './tag'

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
    tagsPending = {},
    // hold primitives bound to tags
    keysPending = {}

  exprObj.isLoop = true

  function unmountById(riotId) {
    let tag = tagsMounted[riotId]
    tag.unmount()
    arrayishRemove(parent.tags, tagName, tag, true)
    delete tagsMounted[riotId]
  }

  exprObj.unmount = function unmountEach() {
    Object.keys(tagsMounted).forEach(unmountById)
  }

  console.log('====', tagName, '====')
  exprObj.update = function updateEach() {
    let root = mark.parentNode

    let
      itemsUpdated = tmpl(exprObj.val, parent),
      tagsUpdated = []

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
        return !!tmpl(ifExpr, context)
      })
    }

    console.log('---- LOOP ----')
    console.log('ITMS BEF', itemsPrevious)
    console.log('ITMS AFT', itemsUpdated)
    console.log('HTML BEF', root.innerHTML)
    itemsUpdated.forEach((item, i) => {
      // cache the original item
      const _item = item
      // with "no-order" flag we always use previous tags
      const usePrevious = tagsPrevious.length > i &&
        (noReorder || itemsPrevious[i] === item)

      let tag = usePrevious ? tagsPrevious[i] :
        // check if this item was already linked
        isObject(item) && tagsMounted[item._riot_id] ||
        // primitive values behave differently
        !isObject(item) && keysPending[item]

      console.log('ITEM #' + i, item)

      // extend item to account for "key" bindings
      if (!hasKeys && exprObj.key)
        item = mkitem(exprObj, item, i)

      if (!tag) {
        // new tag
        tag = new Tag(impl, {
          parent,
          isLoop: true,
          anonymous: !__TAG_IMPL[tagName],
          root: useRoot ? root : dom.cloneNode(),
          item
        }, dom.innerHTML)

        // link the original item to it's tag
        isObject(_item) ?
          defineProperty(_item, '_riot_id', tag._riot_id) :
          keysPending[_item] = tag

        tagsMounted[tag._riot_id] = tag

        tag.mount()

        if (child)
          arrayishAdd(parent.tags, tagName, tag, true)

        // cache parent tag internally
        defineProperty(tag, '_parent', parent)
        // this will be used in events bound to this node
        tag._item = item
      } else {
        tag.update(item)

        if (!child && tag.tags)
        // non-custom tags should have their nested tags moved
          moveNestedTags(tag, i)
      }

      tagsUpdated.push(tag)

      tagsPending[tag._riot_id] = true
    })

    tagsUpdated.forEach((tag, i) => {
      isVirtual ?
        makeVirtual(tag, root, mark) :
        root.insertBefore(tag.root, mark)
    })
    console.log('HTML AFT', root.innerHTML)

    let mounted = Object.keys(tagsMounted)
    // unmount redundant
    Object
      .keys(keysPending)
      .map(key => keysPending[key])
      .concat(mounted)
      .filter(riotId => isUndefined(tagsPending[riotId]))
      .forEach(unmountById)

    // clear updated
    Object
      .keys(tagsPending)
      .forEach(riotId => delete tagsPending[riotId])

    tagsPrevious = tagsUpdated.slice()
    itemsPrevious = itemsUpdated.slice()

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
