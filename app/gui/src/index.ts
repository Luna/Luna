import '#/styles.css'
import '#/tailwind.css'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createQueryClient } from 'enso-common/src/queryClient'
import { MotionGlobalConfig } from 'framer-motion'
import * as idbKeyval from 'idb-keyval'
import { createApp } from 'vue'
import App from './App.vue'

const SCAM_WARNING_TIMEOUT = 1000
function printScamWarning() {
  if (process.env.NODE_ENV === 'development') return
  const headerCss = `
    color: white;
    background: crimson;
    display: block;
    border-radius: 8px;
    font-weight: bold;
    padding: 10px 20px 10px 20px;
  `
    .trim()
    .replace(/\n\s+/, ' ')
  const headerCss1 = headerCss + ' font-size: 46px;'
  const headerCss2 = headerCss + ' font-size: 20px;'
  const msgCSS = 'font-size: 16px;'

  const msg1 =
    'This is a browser feature intended for developers. If someone told you to ' +
    'copy-paste something here, it is a scam and will give them access to your ' +
    'account and data.'
  const msg2 = 'See https://enso.org/selfxss for more information.'
  console.log('%cStop!', headerCss1)
  console.log('%cYou may be the victim of a scam!', headerCss2)
  console.log('%c' + msg1, msgCSS)
  console.log('%c' + msg2, msgCSS)
}

printScamWarning()
let scamWarningHandle = 0

window.addEventListener('resize', () => {
  window.clearTimeout(scamWarningHandle)
  scamWarningHandle = window.setTimeout(printScamWarning, SCAM_WARNING_TIMEOUT)
})

function main() {
  const store = idbKeyval.createStore('enso', 'query-persist-cache')
  const queryClient = createQueryClient({
    persisterStorage: {
      getItem: async (key) => idbKeyval.get(key, store),
      setItem: async (key, value) => idbKeyval.set(key, value, store),
      removeItem: async (key) => idbKeyval.del(key, store),
      clear: async () => idbKeyval.clear(store),
    },
  })

  const areAnimationsDisabled =
    window.DISABLE_ANIMATIONS === true ||
    localStorage.getItem('disableAnimations') === 'true' ||
    false

  MotionGlobalConfig.skipAnimations = areAnimationsDisabled

  if (areAnimationsDisabled) {
    document.documentElement.classList.add('disable-animations')
  } else {
    document.documentElement.classList.remove('disable-animations')
  }

  const app = createApp(App)
  app.use(VueQueryPlugin, { queryClient })
  app.mount('#enso-app')
}

main()
