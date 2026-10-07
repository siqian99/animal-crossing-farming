/* 数据与使用说明页：鸣谢、数据来源、联系方式与免责声明。
   小程序不支持外链跳转，链接与邮箱统一复制到剪贴板。 */
Page({
  onCopy(e) {
    const { url, hint } = e.currentTarget.dataset;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: hint || '已复制，可在浏览器打开', icon: 'none' })
    });
  },

  onShareAppMessage() {
    return { title: '无人岛料理收益管家 · 动森料理与农田收益规划', path: '/pages/index/index' };
  }
});
