## AI 规范
- LLM 必须运行在 JSON Mode，并通过 common/types/ai-response.schema.ts 校验
- Service 仅返回 { reply, correction, cultureNote, associativePhrases, score } 结构
- DeepSeek 接入：设置 DS_AI_API_KEY（必填）、DS_AI_API_URL=https://api.deepseek.com/v1、DS_AI_MODEL=deepseek-chat
- SDK 兼容 OpenAI，可沿用如下示例：

  `	s
  import OpenAI from 'openai';

  const openai = new OpenAI({
    baseURL: process.env.DS_AI_API_URL ?? 'https://api.deepseek.com',
    apiKey: process.env.DS_AI_API_KEY!,
  });

  const completion = await openai.chat.completions.create({
    model: process.env.DS_AI_MODEL ?? 'deepseek-chat',
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
  });
  `

- Key 缺失时后端会落回模板响应，仅用于本地调试，部署务必写入变量
---11-16  
> 鑼冨洿锛歁onorepo锛坅pps/web, apps/server锛夌幇鐘跺榻?
---

## 鐩綍
- 椤圭洰姒傝堪
- 鏍稿績鎶€鏈爤
- 缁熶竴绾︽潫
- 鍓嶇锛坅pps/web锛夎鑼?- 鍚庣锛坅pps/server锛夎鑼?- 鏁版嵁搴?Prisma
- AI 瑙勮寖
- Monorepo 缁撴瀯
- 閮ㄧ讲涓庡懡浠?
---

## 椤圭洰姒傝堪
luvTALK 鏄竴娆?AI 椹卞姩鐨勮瑷€瀛︿範 PWA锛堢菠璇?鑻辫锛夛紝鎻愪緵瀹炴椂瀵硅瘽銆佺籂閿欍€佺炕璇戝拰鏀惰棌銆?
---

## 鏍稿績鎶€鏈爤
- Monorepo锛歍urborepo + pnpm
- 璇█锛歍ypeScript
- 鍓嶇锛歊eact 19 + Ionic React 8, Vite, Zustand
- 鍚庣锛歂estJS 11锛孭risma锛孭ostgreSQL
- AI锛欸emini锛圝SON mode锛夈€丟oogle STT/TTS

---

## 缁熶竴绾︽潫
- TS 鍏ㄩ噺浣跨敤 `.ts/.tsx`锛屼弗鏍兼ā寮忥紱鍓嶇/鍚庣鍏变韩 TypeScript-first銆?- Lint 涓庢牸寮忥細閬靛惊椤圭洰鍐?eslint/prettier 閰嶇疆锛坄pnpm lint`锛夈€?- API 杈撳叆蹇呴』 DTO锛坈lass-validator锛夛紱AI 缁撴瀯蹇呴』 Zod 鏍￠獙銆?- 鏁版嵁鏉ユ簮鍞竴锛歅risma Schema锛涜縼绉荤敤 `prisma migrate`銆?- 鍝嶅簲缁撴瀯锛堝悗绔?Interceptor锛夛細`{ data?: any; error?: { message: string; code?: string } }`

---

## 鍓嶇锛坅pps/web锛夎鑼?**妗嗘灦涓庝緷璧?*  
- Ionic React 8锛坄@ionic/react`, `@ionic/react-router`锛夛紝React Router v5銆?- PWA锛歚vite-plugin-pwa` + `@ionic/pwa-elements`锛堥渶鍦ㄥ叆鍙ｅ姞杞斤級銆?
**鐩綍缁撴瀯锛堢幇鐘讹級**
```
apps/web/src
鈹溾攢 components/        # 绾?UI 缁勪欢
鈹? 鈹斺攢 navigation/     # 搴曢儴瀵艰埅绛?鈹溾攢 hooks/
鈹溾攢 pages/
鈹? 鈹溾攢 Conversation/
鈹? 鈹斺攢 Favorites/
鈹溾攢 services/          # API 璋冪敤
鈹溾攢 shared/            # 鍏变韩缁勪欢/鐘舵€?绫诲瀷
鈹溾攢 store/             # Zustand
鈹溾攢 theme/             # 鏍峰紡涓庡彉閲?鈹溾攢 types/
鈹溾攢 App.tsx
鈹斺攢 main.tsx
```

**椤甸潰涓庤矾鐢?*
- 鎵€鏈夐〉闈㈢粍浠跺繀椤诲 `<IonPage>`銆?- 璺敱浣跨敤 `<IonReactRouter>` + `<IonRouterOutlet>`锛涜矾寰勪笌鏂囦欢澶瑰悕淇濇寔 PascalCase 椤甸潰鐩綍銆?
**鏍峰紡**
- 涓婚鍙橀噺闆嗕腑 `theme/variables.css`锛岀粍浠舵牱寮忓悓绾?`.css`銆?
**鍛藉悕寤鸿锛堣嫢璋冩暣锛?*
- 椤甸潰鐩綍缁存寔 PascalCase锛涙湇鍔℃枃浠跺皬鍐欓┘宄帮紙宸查伒瀹堬紝濡?`conversationService.ts`锛夈€?- `shared` 涓嬪瓙鐩綍璇箟鍖栧懡鍚嶏紝閬垮厤绌虹洰褰曪紙褰撳墠 `shared/api` 涓虹┖锛屽彲娓呯悊鎴栬ˉ鍏呯被鍨嬶級銆?
---

## 鍚庣锛坅pps/server锛夎鑼?**妗嗘灦涓庝緷璧?*  
- NestJS 11锛孋ommonJS 鏋勫缓锛涗弗鏍间娇鐢?`@Injectable` + 鏋勯€犳敞鍏ャ€?
**鐩綍缁撴瀯锛堢幇鐘讹級**
```
apps/server/src
鈹溾攢 common/
鈹? 鈹溾攢 enums/          # e.g., favorite-type.enum.ts
鈹? 鈹斺攢 types/          # e.g., ai-response.schema.ts
鈹溾攢 core/
鈹? 鈹斺攢 prisma/         # prisma.module.ts, prisma.service.ts
鈹溾攢 modules/
鈹? 鈹溾攢 conversation/
鈹? 鈹? 鈹溾攢 dto/
鈹? 鈹? 鈹溾攢 conversation.controller.ts
鈹? 鈹? 鈹斺攢 conversation.service.ts
鈹? 鈹溾攢 favorites/
鈹? 鈹? 鈹溾攢 dto/
鈹? 鈹? 鈹溾攢 favorites.controller.ts
鈹? 鈹? 鈹斺攢 favorites.service.ts
鈹? 鈹溾攢 health/
鈹? 鈹斺攢 translation/
鈹溾攢 app.module.ts
鈹斺攢 main.ts
```

**鍒嗗眰瑕佹眰**
- Module 瀹氫箟杈圭晫锛汣ontroller 浠呰矾鐢?DTO 缁戝畾锛汼ervice 鍐欎笟鍔★紱PrismaService 浣滀负鍞竴鏁版嵁璁块棶銆?- DTO: `class-validator` 鍏ㄩ噺鏍￠獙鍏ュ彛銆?- 涓嶅厑璁哥洿鎺ュ湪 Controller 浣跨敤 Prisma Client銆?
**鍛藉悕浼樺寲寤鸿**
- `core/prisma` 鍛藉悕绗﹀悎瑙勮寖锛涙棤闇€璋冩暣銆?- `common/types` 閲?AI Schema 搴斾互 `*.schema.ts` 鍛藉悕锛堝凡绗﹀悎锛夈€?
---

## 鏁版嵁搴?/ Prisma
- Schema 浣嶇疆锛歚apps/server/prisma/schema.prisma`
- 鍏抽敭妯″瀷锛堢幇鐘讹級锛?  - `Conversation`锛坢essages JSON锛宻core 鍙€夛紝鍏宠仈 favorites锛?  - `Favorite`锛坱itle/content/type/metadata锛屽彲鍏宠仈 conversation锛?  - `TranslationRecord`
  - `enum FavoriteType { phrase | cultural | vocabulary | scenario }`
- 杩佺Щ涓庣敓鎴愶細
  - 寮€鍙戯細`pnpm prisma migrate dev --schema apps/server/prisma/schema.prisma`
  - 閮ㄧ讲锛歚pnpm prisma migrate deploy --schema apps/server/prisma/schema.prisma`
  - Client锛歚pnpm prisma generate --schema apps/server/prisma/schema.prisma`

---

## AI 瑙勮寖
- LLM 蹇呴』浣跨敤 JSON Mode锛涜緭鍑虹粡 Zod 鏍￠獙鍚庡啀杩斿洖涓氬姟灞傘€?- Service 涓嶈繑鍥炲師濮嬪瓧绗︿覆锛屽彧杩斿洖缁撴瀯鍖栧璞°€?- 寤鸿鍦?`common/types/ai-response.schema.ts` 鎸佺画缁存姢 Zod Schema銆?
---

## Monorepo 缁撴瀯锛堢幇鐘讹級
```
luvtalk/
鈹溾攢 apps/
鈹? 鈹溾攢 web/           # Ionic PWA
鈹? 鈹斺攢 server/        # NestJS API
鈹溾攢 node_modules/
鈹溾攢 pnpm-workspace.yaml
鈹溾攢 package.json      # Turbo tasks
鈹斺攢 turbo.json
```
- 褰撳墠鏃?`packages/` 鐩綍锛涘闇€鍏变韩绫诲瀷鍙悗缁柊澧?`packages/shared`銆?
---

## 閮ㄧ讲涓庡懡浠?**鏍圭骇**
- 寮€鍙戯細`pnpm dev`锛坱urbo 骞惰 web/server锛?- 鏋勫缓锛歚pnpm build`
- Lint锛歚pnpm lint`

**鍓嶇**
- 寮€鍙戯細`pnpm --filter web dev`
- 鏋勫缓锛歚pnpm --filter web build`
- 棰勮锛歚pnpm --filter web preview`

**鍚庣**
- 寮€鍙戯細`pnpm --filter server dev`
- 鏋勫缓锛歚pnpm --filter server build`
- 杩愯 prod锛歚pnpm --filter server start:prod`
- 娴嬭瘯锛歚pnpm --filter server test`
- Prisma锛歚pnpm --filter server prisma:migrate`

---

## 寰呬紭鍖栧缓璁?- 娓呯悊 `apps/web/src/shared/api` 绌虹洰褰曟垨琛ュ厖鍏变韩 API 绫诲瀷锛堥伩鍏嶇┖鏂囦欢澶癸級銆?- 鑻ヨ鍒掑叡浜?DTO/绫诲瀷锛屾柊澧?`packages/shared` 骞剁敤璺緞鍒悕澶嶇敤銆?- 纭 web 绔?PWA 鍒濆鍖栧湪鍏ュ彛宸茶皟鐢?`@ionic/pwa-elements/loader`锛堝綋鍓嶉渶妫€鏌?App 鍏ュ彛钀藉疄锛夈€?


