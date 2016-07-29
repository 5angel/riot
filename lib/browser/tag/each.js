import {
  FIREFOX,
  __TAG_IMPL
} from './../common/global-variables'

import { tmpl } from 'riot-tmpl'
import Tag from './tag'

import LoopCache from './loopCache'

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
  each,
  clear,
  defineProperty,
  isArray,
  makeVirtual,
  moveNestedTags
} from './../common/util'

export default function _each(dom, parent, expr) {
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

  const cache = new LoopCache()

  let tagsPrevious = []

  const
    tagsMounted = {},
    tagsPending = {}

  exprObj.isLoop = true
  // this should persist outside loops
  exprObj.hasKeys = false

  function getValue(item) {
    return !exprObj.hasKeys ? item : item[exprObj.key]
  }

  function unmountById(id) {
    const
      tag = tagsMounted[id],
      raw = !exprObj.key ? tag._item : tag._item[exprObj.key]

    console.log('REMOVE #' + tag._riot_id, tag.root.outerHTML)

    cache.clearLink(getValue(tag._item))
    tag.unmount()
    arrayishRemove(parent.tags, tagName, tag, true)

    delete tagsMounted[id]
  }

  exprObj.unmount = function unmountEach() {
    each(tagsMounted, (tag, id) => {
      unmountById(id)
    })

    console.log('==== </' + tagName + '> ====')
  }

  console.log('==== <' + tagName + '> ====')
  console.log('ORIGIN', dom.outerHTML)
  exprObj.update = function updateEach() {
    let root = mark.parentNode
    let itemsUpdated = tmpl(exprObj.val, parent)

    // objects cause full redraw
    if (!isArray(itemsUpdated)) {
      console.log('NOT ARRAY', itemsUpdated)
      exprObj.hasKeys = Boolean(itemsUpdated)
      itemsUpdated = exprObj.hasKeys
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

    console.log('---- LOOP ' + tagName + ' ----')
    console.log('ITEMS', itemsUpdated)
    console.log('HTML BEF', root.innerHTML)

    const tagsUpdated = cache.listLinks(itemsUpdated)

    console.log('LINKS', tagsUpdated.map(t => !t ? '?' : '#' + t._riot_id).join(', '))

    let target = mark

    for (let i = 0; i < itemsUpdated.length; ++i) {
      const raw = itemsUpdated[i]

      let item = !exprObj.hasKeys && exprObj.key
        ? mkitem(exprObj, raw, i) : raw

      // with "no-order" flag we re-use previous tags
      let tag = tagsPrevious.length > i && noReorder ?
        tagsPrevious[i] : tagsUpdated[i]

      if (tag) {
        tag.update(item)

        console.log('UPDATE #' + tag._riot_id + ' WITH ITEM №' + i, item)

        const movedPrevious = tagsPrevious[i] !== tagsUpdated[i]
        // non-custom tags should have their nested tags moved as well
        if (!child && tag.tags && movedPrevious)
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

        console.log('ADD #' + tag._riot_id + ' WITH ITEM №' + i, item)

        // link item to it's tag
        if (!noReorder)
          cache.setLink(tag, getValue(raw))

        tagsMounted[tag._riot_id] = tag

        tag.mount()
      }

      // cache parent tag internally
      defineProperty(tag, '_parent', parent)
      // this will be used in events bound to this node
      tag._item = item

      tagsUpdated[i] = tagsPending[tag._riot_id] = tag
    }

    const frag = document.createDocumentFragment()

    tagsUpdated.forEach(tag => {
      isVirtual ?
        makeVirtual(tag, root) :
        frag.appendChild(tag.root)
    })

    root.insertBefore(frag, mark)

    // unmount redundant
    each(tagsMounted, (tag, id) => {
      if (!tagsPending[id]) {
        unmountById(id)
      }
    })

    // clear pending
    clear(tagsPending)

    console.log('HTML AFT', root.innerHTML)

    tagsPrevious = tagsUpdated.slice()

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
