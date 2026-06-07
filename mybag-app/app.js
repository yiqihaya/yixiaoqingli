import { app } from 'nitron'

app.init({
  name: '小晴',
  packageId: 'com.mybag.xiaoqing',
  versionName: '1.0.0',
  versionCode: 1,

  permissions: [
    'INTERNET',
    'RECORD_AUDIO',
  ],

  networkSecurity: {
    cleartext: true,
  },
})
