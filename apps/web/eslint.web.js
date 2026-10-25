import globals from 'globals';
export default {files:['apps/web/integration/**/*.js'],languageOptions:{globals:{...globals.browser,...globals.worker,__APP_VERSION__:'readonly',__APP_COMMIT__:'readonly'}}};
