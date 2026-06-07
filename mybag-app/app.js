import { app } from 'nitron'

app.init({
  name: '小晴',
  packageId: 'com.mybag.xiaoqing',
  versionName: '1.0.0',
  versionCode: 2,

  permissions: [
    'INTERNET',
    'ACCESS_NETWORK_STATE',
    'ACCESS_WIFI_STATE',
    'RECORD_AUDIO',
  ],

  networkSecurity: {
    cleartext: true,
    // 允许所有域名
    baseConfig: `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>`,
  },
})
