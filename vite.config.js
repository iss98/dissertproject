import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                stageOne : resolve(__dirname, 'stageOne.html'),
                stageTwo : resolve(__dirname, 'stageTwo.html'),
                stageThree : resolve(__dirname, 'stageThree.html'),
                stageFour : resolve(__dirname, 'stageFour.html'),
                stageFive : resolve(__dirname, 'stageFive.html'),
                plus : resolve(__dirname, 'plus.html'),
                plusvideo : resolve(__dirname, 'plusvideo.html'),
                plusitem : resolve(__dirname, 'plusitem.html'),
                plusreflection : resolve(__dirname, 'plusreflection.html'),
                minus : resolve(__dirname, 'minus.html'),
                minusvideo : resolve(__dirname, 'minusvideo.html'),
                minusitem : resolve(__dirname, 'minusitem.html'),
                minusreflection : resolve(__dirname, 'minusreflection.html'),
                mul : resolve(__dirname, 'mul.html'),
                mulvideo : resolve(__dirname, 'mulvideo.html'),
                mulitem : resolve(__dirname, 'mulitem.html'),
                mulreflection : resolve(__dirname, 'mulreflection.html'),
                div : resolve(__dirname, 'div.html'),
                divvideo : resolve(__dirname, 'divvideo.html'),
                divitem : resolve(__dirname, 'divitem.html'),
                divreflection : resolve(__dirname, 'divreflection.html'),
                hlep : resolve(__dirname, 'help.html'),
                shelp : resolve(__dirname, "shelp.html"),
                nhelp : resolve(__dirname, 'nhelp.html'),
                goalsetting : resolve(__dirname, 'goalsetting.html'),
            },
        },
    },
})