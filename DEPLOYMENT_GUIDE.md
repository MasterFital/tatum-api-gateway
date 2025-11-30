# 🚀 GITHUB + VERCEL DEPLOYMENT GUIDE

## RESUMEN RÁPIDO
Este API Gateway está 100% listo para producción. Solo necesitas 3 pasos:
1. Subir a GitHub
2. Conectar a Vercel
3. Configurar env variables

**Tiempo total**: ~10 minutos

---

## PASO 1: GITHUB (Subir el código)

### 1.1 Crear repositorio en GitHub
```
1. Ve a https://github.com/new
2. Repository name: tatum-api-gateway
3. Description: Enterprise-grade blockchain API gateway (Crypto Panel + RWA tokenization)
4. Public (✓)
5. Do NOT check "Add a README file" (ya lo tenemos)
6. Click "Create repository"
```

### 1.2 En tu terminal local
```bash
# Navega a tu carpeta del proyecto
cd /ruta/al/proyecto

# Verifica que Git está inicializado
git status

# Si no está inicializado:
git init
git add .
git commit -m "Initial commit: Tatum API Gateway with Crypto Panel + RWA tokenization"

# Agrega GitHub como remote (reemplaza MasterFital con tu usuario)
git remote add origin https://github.com/MasterFital/tatum-api-gateway.git

# Sube a main branch
git branch -M main
git push -u origin main

# Verifica que funcionó:
git remote -v
```

### 1.3 Verifica en GitHub
```
1. Ve a https://github.com/MasterFital/tatum-api-gateway
2. Deberías ver todos los archivos
3. Verifica que README.md, package.json, y server/ están ahí
```

---

## PASO 2: VERCEL (Deploy automático)

### 2.1 Conectar GitHub a Vercel
```
1. Ve a https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Click "Import Git Repository"
4. Busca: tatum-api-gateway
5. Selecciona el repo
6. Click "Import"
```

### 2.2 Configurar Build Settings
```
Vercel auto-detectará:
- Framework: Node.js
- Build Command: npm run build
- Output Directory: (auto)

DEJA TODO POR DEFAULT - No cambies nada
```

### 2.3 Vercel debería mostrar:
```
✓ Build successful
✓ Deployment successful
```

Si falla, mira el próximo paso (env variables)

---

## PASO 3: CONFIGURAR VARIABLES DE ENTORNO (CRÍTICO)

### 3.1 En Vercel Dashboard
```
1. Ve a tu project en Vercel
2. Click "Settings" (arriba)
3. Click "Environment Variables" (left sidebar)
4. Agrega estas variables (una por una):
```

### 3.2 Variable 1: TATUM_API_KEY
```
Name: TATUM_API_KEY
Value: [Tu API key de Tatum]

Para conseguir:
1. Ve a https://dashboard.tatum.io
2. Log in o crea cuenta (es gratis)
3. Copia tu API KEY (production)
4. Pégala aquí

Environments: Production (checked)
Click "Save"
```

### 3.3 Variable 2: SESSION_SECRET
```
Name: SESSION_SECRET
Value: [Generar random secret]

Para generar (en tu terminal):
$ openssl rand -hex 32
# Output: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6...

Pega el output en Vercel

Environments: Production (checked)
Click "Save"
```

### 3.4 Variable 3: DATABASE_URL
```
Name: DATABASE_URL
Value: [Tu PostgreSQL connection string]

Si usas Neon (recomendado):
1. Ve a https://neon.tech
2. Crea proyecto (gratis)
3. Copia connection string
4. Pégala aquí

Ejemplo: postgresql://user:password@host:5432/dbname

Environments: Production (checked)
Click "Save"
```

### 3.5 Redeploy
```
Después de agregar env variables:
1. Ve a "Deployments"
2. Click los 3 puntos (⋯) del último deploy
3. Click "Redeploy"
4. Espera 2-3 minutos

Deberías ver: "Deployment successful"
```

---

## PASO 4: VERIFICAR QUE FUNCIONA

### Test 1: Root Endpoint
```bash
curl https://your-vercel-domain.vercel.app/

Deberías ver:
{
  "name": "Tatum API Gateway",
  "version": "1.0.0",
  "status": "running",
  ...
}
```

### Test 2: Documentación
```bash
curl https://your-vercel-domain.vercel.app/api/docs
curl https://your-vercel-domain.vercel.app/api/docs/model
curl https://your-vercel-domain.vercel.app/api/docs/examples
```

### Test 3: Tatum Connection (IMPORTANTE)
```bash
curl https://your-vercel-domain.vercel.app/api/test-tatum

Deberías ver:
{
  "success": true,
  "test": "Tatum API Connection Test",
  "status": {
    "message": "✅ Connected to Tatum API successfully",
    ...
  }
}
```

Si ves "success": true → ¡TODO FUNCIONA! 🎉
Si ves "success": false → Revisa la sección TROUBLESHOOTING

---

## PASO 5: CUSTOM DOMAIN (Opcional)

### Para usar tu propio dominio
```
1. En Vercel → Settings → Domains
2. Click "Add"
3. Ingresa: api.tudominio.com
4. Vercel te muestra los DNS records
5. Agrega esos records en tu proveedor de dominio
6. Espera ~10 minutos para que se propague
7. Listo!
```

---

## URLs IMPORTANTES

| URL | Propósito |
|-----|-----------|
| https://github.com/MasterFital/tatum-api-gateway | Tu código en GitHub |
| https://vercel.com/dashboard | Tu dashboard de Vercel |
| https://your-vercel-domain.vercel.app | Tu API en producción |
| https://dashboard.tatum.io | Para obtener API key |
| https://neon.tech | Para obtener database |

---

## CHECKLIST FINAL

Antes de considerar "listo":
- [ ] GitHub repo creado y código pusheado
- [ ] Vercel project creado y conectado a GitHub
- [ ] TATUM_API_KEY agregada en env variables
- [ ] SESSION_SECRET agregada en env variables
- [ ] DATABASE_URL agregada en env variables
- [ ] Vercel deployment exitoso (verde)
- [ ] Test root endpoint: `GET /` retorna JSON
- [ ] Test Tatum: `GET /api/test-tatum` retorna success: true
- [ ] Test documentación: `GET /api/docs` funciona

---

## TROUBLESHOOTING

### Error: "Build failed" en Vercel
```
1. Ve a Vercel → Deployments
2. Click el deployment fallido
3. Ve a "Build Logs"
4. Lee los últimos 20 líneas del error
5. Usualmente dice qué falta (env variable, etc)
6. Arregla y click "Redeploy"
```

### Error: "502 Bad Gateway"
```
Solución rápida:
1. Espera 2 minutos
2. Si persiste, revisa que DATABASE_URL está correcta
3. Si sigue, revisa logs en Vercel

Los logs te dicen exactamente qué está mal
```

### Error: Tatum connection failed
```
Verifica:
1. TATUM_API_KEY está configurada en Vercel
2. Es tu KEY DE PRODUCTION (no testnet)
3. Tu key está activa en https://dashboard.tatum.io
4. No tiene espacios en blanco

Si todo bien y sigue fallando:
- Espera 5 minutos
- Redeploy
- Si persiste, genera nueva key en Tatum
```

### Error: "EADDRINUSE: address already in use :::5000"
```
Esto es solo en desarrollo local, ignorar en producción
(no aparece en Vercel)
```

---

## DESPUÉS DE DESPLEGAR

### 1. Configurar CI/CD
```
Vercel automáticamente:
- Re-deploya cuando haces push a main
- Corre tests (si tienes)
- Crea preview URLs para PRs
```

### 2. Monitorear
```
En Vercel:
- Revisa Analytics periodicamente
- Monitorea Edge Function usage
- Revisa logs de errors
```

### 3. Actualizar código
```
Para hacer cambios:
1. Haz cambios locales
2. git add .
3. git commit -m "Description"
4. git push origin main
5. Vercel auto-deploya en ~1 minuto
```

---

## SOPORTE

Si algo falla:
1. **GitHub Issues**: Crea issue en https://github.com/MasterFital/tatum-api-gateway/issues
2. **Vercel Support**: https://vercel.com/support
3. **Tatum Docs**: https://docs.tatum.io
4. **Logs**: Mira los logs en Vercel dashboard

---

## PRÓXIMOS PASOS (Después de desplegar)

1. **Test con clientes reales**
   - Crea API keys para clientes
   - Dale endpoints a clientes
   - Monitorea uso

2. **Mejoras a considerar**
   - Agregawebhooks de Tatum
   - Integrar KYC/AML
   - Analytics avanzadas
   - Client dashboard

3. **Escalado**
   - Aumentar Tatum tier si necesitas más requests
   - Configurar caching
   - Optimizar queries de base de datos

---

**¡Tu API Gateway está listo para producción! 🚀**

Tiempo estimado: 10 minutos  
Costo inicial: $0 (plan gratis de Vercel + Tatum free tier)

