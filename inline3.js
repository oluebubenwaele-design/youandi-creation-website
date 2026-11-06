
        // Dynamic App State
        let appState = {
            mode: 'customer', // 'customer' or 'admin'
            currency: 'NGN',  // Nigerian Naira only
            activeTab: 'home',
            cart: [],
            activeCategory: 'all',
            activeProjectFilter: 'all',
            quoteSpace: 'living',
            quoteSqft: 500,
            quoteBasePrice: 50,
            checkoutPayMethod: 'card',
            
            // Database Collections
            products: [],



            orders: [],

            projects: []
        };
        const productQtySelections = {};

        // NGN-only price formatter. Delivery is quoted separately and never added to checkout automatically.
        function formatPrice(ngnVal) {
            const value = Number(ngnVal || 0);
            return `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
        }

        // Toggle App Mode (Customer View vs Admin Portal)
        // Secure Admin Mode
        function hasAdminSession() { return !!localStorage.getItem('youI_admin_token'); }
        function openAdminLogin() {
            const m = document.getElementById('adminLoginModal');
            m.classList.remove('hidden'); m.classList.add('flex');
            setTimeout(() => document.getElementById('adminLoginEmail')?.focus(), 50);
        }
        function closeAdminLogin() {
            const m = document.getElementById('adminLoginModal');
            m.classList.add('hidden'); m.classList.remove('flex');
        }
        async function adminLogin() {
            const email = document.getElementById('adminLoginEmail').value.trim();
            const password = document.getElementById('adminLoginPassword').value;
            const err = document.getElementById('adminLoginError');
            const btn = document.getElementById('adminLoginBtn');
            err.classList.add('hidden'); btn.disabled = true; btn.innerText = 'Signing in...';

            try {
                // Use the current site origin explicitly. This avoids the generic iOS/Safari
                // DOMException ("The string did not match the expected pattern") that can
                // occur when a relative request is handled unexpectedly by WebKit.
                const endpoint = new URL('/api/admin-products', window.location.origin).toString();
                const data = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', endpoint, true);
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState !== 4) return;
                        let payload = {};
                        try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : {}; }
                        catch (_) { payload = {}; }
                        if (xhr.status >= 200 && xhr.status < 300) resolve(payload);
                        else reject(new Error(payload.error || `Login request failed (${xhr.status}).`));
                    };
                    xhr.onerror = function () { reject(new Error('Unable to reach the admin login service. Please try again.')); };
                    xhr.ontimeout = function () { reject(new Error('The admin login request timed out. Please try again.')); };
                    xhr.timeout = 15000;
                    xhr.send(JSON.stringify({ action:'login', email, password }));
                });

                if (!data.token) throw new Error(data.error || 'Login failed.');
                localStorage.setItem('youI_admin_token', data.token);
                closeAdminLogin(); toggleAppMode(true);
            } catch(e) {
                err.textContent = e && e.message ? e.message : 'Login failed. Please try again.';
                err.classList.remove('hidden');
            } finally {
                btn.disabled=false; btn.innerText='Sign In';
            }
        }
        function logoutAdmin() { localStorage.removeItem('youI_admin_token'); appState.mode='customer'; toggleAppMode(false); showToast('Admin signed out.'); }
        function toggleAppMode(forceAdmin) {
            if (forceAdmin === true || appState.mode === 'customer') {
                if (!hasAdminSession()) { openAdminLogin(); return; }
                appState.mode='admin';
                document.getElementById('customerView').classList.add('hidden');
                document.getElementById('customerView').style.display='none';
                document.getElementById('adminView').classList.remove('hidden');
                document.getElementById('adminView').style.display='block';
                document.getElementById('customerNav').classList.add('hidden');
                document.getElementById('adminNavBadge').classList.remove('hidden');
                document.getElementById('adminNavBadge').classList.add('flex');
                document.getElementById('adminNavBadge').style.display='flex';
                document.getElementById('appModeText').innerText='Switch to Customer App';
                renderAdminOrdersTable(); renderAdminProducts(); renderAdminProjects(); loadProjectsFromServer(); loadAdminStats();
            } else {
                appState.mode='customer';
                document.getElementById('adminView').classList.add('hidden');
                document.getElementById('adminView').style.display='none';
                document.getElementById('customerView').classList.remove('hidden');
                document.getElementById('customerView').style.display='block';
                document.getElementById('adminNavBadge').classList.add('hidden');
                document.getElementById('adminNavBadge').classList.remove('flex');
                document.getElementById('adminNavBadge').style.display='none';
                document.getElementById('customerNav').classList.remove('hidden');
                document.getElementById('appModeText').innerText='Switch to Admin Portal';
            }
        }

        // Tab Switcher
        function switchTab(tabId) {
            appState.activeTab = tabId;
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(c => c.classList.add('hidden'));
            contents.forEach(c => c.classList.remove('block'));

            const target = document.getElementById(`tab-${tabId}`);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('block');
            }

            // Update Nav Highlights
            const links = document.querySelectorAll('.nav-link');
            links.forEach(l => l.className = 'nav-link text-champagne-300/80 hover:text-champagne-400 transition-colors py-2');
            const activeNav = document.getElementById(`nav-${tabId}`);
            if (activeNav) activeNav.className = 'nav-link text-champagne-400 hover:text-white transition-colors py-2 font-bold border-b-2 border-champagne-400';

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function toggleMobileMenu() {
            document.getElementById('mobileMenu').classList.toggle('hidden');
        }

        // Before & After Drag Slider
        function updateBeforeAfterSlider(val) {
            document.getElementById('afterImageWrapper').style.width = `${val}%`;
        }

        // Render Home Featured Products
        function renderHomeFeatured() {
            const grid = document.getElementById('homeFeaturedProductsGrid');
            if (!grid) return;
            grid.innerHTML = '';

            appState.products.slice(0, 4).forEach(prod => {
                grid.innerHTML += `
                    <div class="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 group">
                        <div class="relative h-60 overflow-hidden">
                            <img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3 right-3 bg-black/80 text-champagne-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-champagne-500/30">${prod.stock}</span>
                        </div>
                        <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
                            <div>
                                <h3 class="product-title font-serif text-lg font-bold text-white transition-colors">${prod.name}</h3>
                                <p class="product-description text-sm sm:text-base text-champagne-100/90 mt-2 leading-6 line-clamp-4">${prod.description}</p>
                            </div>
                            <div class="flex items-center justify-between pt-3 border-t border-champagne-500/10">
                                <div>
                                    <span class="product-price font-serif text-xl sm:text-2xl font-bold gold-gradient-text block">${formatPrice(prod.priceNGN)}</span>
                                    <span class="product-unit text-[10px] uppercase tracking-wider text-champagne-200/70">Per piece / item</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <button onclick="addToCart('${prod.id}', 1)" class="w-8 h-8 rounded-lg bg-espresso-900 border border-champagne-500/30 text-champagne-300 hover:text-white" aria-label="Add one piece">+</button>
                                    <button onclick="addToCart('${prod.id}', 1)" class="px-3.5 py-2 rounded-xl bg-champagne-500/10 hover:bg-champagne-500 hover:text-black border border-champagne-500/30 text-champagne-400 text-xs font-semibold transition-all flex items-center space-x-1.5">
                                        <i class="fas fa-cart-plus text-xs"></i>
                                        <span>Add 1</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        // Filter Products in Catalog Tab
        function selectCategory(cat) {
            appState.activeCategory = cat;
            const btns = document.querySelectorAll('.cat-btn');
            btns.forEach(b => {
                b.className = 'cat-btn px-5 py-2.5 rounded-full border border-champagne-500/30 bg-espresso-900 text-champagne-300 hover:border-champagne-400 whitespace-nowrap transition-all';
            });
            event.currentTarget.className = 'cat-btn active px-5 py-2.5 rounded-full border border-champagne-400 bg-champagne-500 text-black whitespace-nowrap transition-all';
            renderProductsCatalog();
        }

        function renderProductsCatalog() {
            const grid = document.getElementById('productsCatalogGrid');
            if (!grid) return;
            grid.innerHTML = '';

            const searchTerm = (document.getElementById('productSearchInput')?.value || '').toLowerCase();

            const filtered = appState.products.filter(p => {
                const matchCat = appState.activeCategory === 'all' || p.category === appState.activeCategory;
                const matchSearch = p.name.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm);
                return matchCat && matchSearch;
            });

            filtered.forEach(prod => {
                grid.innerHTML += `
                    <div class="glass-card glass-card-hover rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 group">
                        <div class="relative h-64 overflow-hidden cursor-pointer" onclick="openProductDetail('${prod.id}')">
                            <img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            <span class="absolute top-3 right-3 bg-black/80 text-champagne-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-champagne-500/30">${prod.stock}</span>
                        </div>
                        <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
                            <div>
                                <h3 onclick="openProductDetail('${prod.id}')" class="product-title font-serif text-lg font-bold text-white transition-colors cursor-pointer">${prod.name}</h3>
                                <p class="product-description text-sm sm:text-base text-champagne-100/90 mt-2 leading-6 line-clamp-4">${prod.description}</p>
                            </div>
                            <div class="flex items-center justify-between pt-3 border-t border-champagne-500/10">
                                <span class="product-price font-serif text-xl sm:text-2xl font-bold gold-gradient-text">${formatPrice(prod.priceNGN)}</span>
                                <div class="flex flex-col gap-3 pt-2">
                                    <div class="flex items-center justify-between rounded-xl border border-champagne-500/30 bg-espresso-900 p-2.5">
                                        <span class="text-[10px] uppercase tracking-wider text-champagne-300/70 font-bold">Pieces</span>
                                        <div class="flex items-center gap-2">
                                            <button onclick="changeProductQty('${prod.id}', -1)" class="w-9 h-9 rounded-lg border border-champagne-500/30 text-champagne-300 hover:text-white hover:border-champagne-400">−</button>
                                            <span id="prodQty-${prod.id}" class="w-7 text-center text-sm font-bold text-white">${productQtySelections[prod.id] || 1}</span>
                                            <button onclick="changeProductQty('${prod.id}', 1)" class="w-9 h-9 rounded-lg border border-champagne-500/30 text-champagne-300 hover:text-white hover:border-champagne-400">+</button>
                                        </div>
                                    </div>
                                    <div class="flex space-x-2">
                                        <button onclick="openProductDetail('${prod.id}')" class="p-2 rounded-xl bg-espresso-900 border border-champagne-500/30 text-champagne-300 hover:text-white text-xs">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button onclick="addToCart('${prod.id}', productQtySelections['${prod.id}'] || 1)" class="flex-1 px-3.5 py-2 rounded-xl bg-champagne-500/20 hover:bg-champagne-500 hover:text-black border border-champagne-400/40 text-champagne-400 text-xs font-semibold transition-all">
                                            Add to Cart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        function changeProductQty(id, delta) {
            const next = Math.max(1, Math.min(100, (Number(productQtySelections[id]) || 1) + delta));
            productQtySelections[id] = next;
            const el = document.getElementById(`prodQty-${id}`);
            if (el) el.textContent = next;
        }

        async function loadProductsFromServer() {
            try {
                const r = await fetch('/api/admin-products', { cache: 'no-store' });
                const data = await r.json();
                if (r.ok && Array.isArray(data.products)) {
                    appState.products = data.products;
                    renderHomeFeatured(); renderProductsCatalog(); renderAdminProducts();
                }
            } catch (e) { console.warn('Product catalog could not be loaded:', e); }
        }

        function renderAdminProducts() {
            const list = document.getElementById('adminProductsList'); if (!list) return;
            list.innerHTML = '';
            appState.products.forEach(prod => {
                list.innerHTML += `<div class="glass-card rounded-2xl p-4 border border-champagne-500/20 flex gap-4">
                    <img src="${prod.image}" alt="${prod.name}" class="w-20 h-20 rounded-xl object-cover">
                    <div class="flex-1 min-w-0"><h4 class="font-serif text-lg font-bold text-white truncate">${prod.name}</h4><p class="text-xs text-champagne-300/60 line-clamp-2">${prod.description}</p><div class="text-sm font-bold gold-gradient-text mt-1">${formatPrice(prod.priceNGN)}</div><div class="text-[10px] text-champagne-400 uppercase mt-1">${prod.stock}</div></div>
                    <div class="flex flex-col gap-2"><button onclick="editAdminProduct('${prod.id}')" class="px-3 py-2 rounded-lg border border-champagne-500/30 text-champagne-300 text-xs">Edit</button><button onclick="deleteAdminProduct('${prod.id}')" class="px-3 py-2 rounded-lg border border-red-500/30 text-red-300 text-xs">Delete</button></div>
                </div>`;
            });
        }

        function openAdminProductForm(product) {
            document.getElementById('adminProductForm').classList.remove('hidden');
            document.getElementById('adminProductFormTitle').innerText = product ? 'Edit Product' : 'Add Product';
            document.getElementById('adminProductId').value = product?.id || '';
            document.getElementById('adminProductName').value = product?.name || '';
            document.getElementById('adminProductPrice').value = product?.priceNGN || '';
            document.getElementById('adminProductCategory').value = product?.category || 'furniture';
            document.getElementById('adminProductStock').value = product?.stock || 'In Stock';
            document.getElementById('adminProductDescription').value = product?.description || '';
            document.getElementById('adminProductImageUrl').value = product?.image || '';
            document.getElementById('adminProductImage').value = '';
            document.getElementById('adminProductSaveBtn').innerText = product ? 'Save Changes' : 'Save Product';
        }
        function closeAdminProductForm() { document.getElementById('adminProductForm').classList.add('hidden'); }
        function editAdminProduct(id) { const p=appState.products.find(x=>x.id===id); if(p) openAdminProductForm(p); }
        async function readImageDataUrl(file) { if(!file) return ''; return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
        async function readProjectImageDataUrl(file) {
            if (!file) return '';
            const maxSide = 1600;
            const targetBytes = 1500000;
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = reject;
                reader.onload = () => {
                    const img = new Image();
                    img.onerror = reject;
                    img.onload = () => {
                        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
                        canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
                        const ctx = canvas.getContext('2d', { alpha: false });
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        let quality = 0.82;
                        let dataUrl = canvas.toDataURL('image/jpeg', quality);
                        while (dataUrl.length > targetBytes * 1.37 && quality > 0.55) {
                            quality -= 0.06;
                            dataUrl = canvas.toDataURL('image/jpeg', quality);
                        }
                        resolve(dataUrl);
                    };
                    img.src = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }
        async function saveAdminProduct() {
            const token=localStorage.getItem('youI_admin_token'); if(!token){openAdminLogin();return;}
            const id=document.getElementById('adminProductId').value.trim();
            const product={ name:document.getElementById('adminProductName').value.trim(), priceNGN:Number(document.getElementById('adminProductPrice').value), category:document.getElementById('adminProductCategory').value, stock:document.getElementById('adminProductStock').value, description:document.getElementById('adminProductDescription').value.trim(), image:document.getElementById('adminProductImageUrl').value.trim() };
            const file=document.getElementById('adminProductImage').files[0]; const btn=document.getElementById('adminProductSaveBtn'); btn.disabled=true; btn.innerText='Saving...';
            try {
                const body={action:id?'update':'create',token,product}; if(id) body.id=id; if(file) body.imageDataUrl=await readImageDataUrl(file);
                const r=await fetch('/api/admin-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await r.json();
                if(r.status===401){localStorage.removeItem('youI_admin_token'); throw new Error('Your admin session expired. Please sign in again.');}
                if(!r.ok) throw new Error(data.error||'Unable to save product.');
                appState.products=data.products; renderHomeFeatured(); renderProductsCatalog(); renderAdminProducts(); loadAdminStats(); closeAdminProductForm(); showToast('Product saved successfully.');
            } catch(e){showToast(e.message);} finally {btn.disabled=false; btn.innerText=id?'Save Changes':'Save Product';}
        }
        async function deleteAdminProduct(id) {
            if(!confirm('Delete this product from the store?')) return;
            const token=localStorage.getItem('youI_admin_token');
            try { const r=await fetch('/api/admin-products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',token,id})}); const data=await r.json(); if(r.status===401){localStorage.removeItem('youI_admin_token');openAdminLogin();return;} if(!r.ok) throw new Error(data.error||'Unable to delete product.'); appState.products=data.products; renderHomeFeatured(); renderProductsCatalog(); renderAdminProducts(); loadAdminStats(); showToast('Product deleted.'); } catch(e){showToast(e.message);}
        }

        function filterProducts() {
            renderProductsCatalog();
        }

        // Signature Service Details
        const signatureServices = {
            'interior-design': {
                name: 'Interior Design',
                image: 'assets/interior-design.jpeg',
                description: 'Complete interior design from concept and space planning through coordinated finishes, lighting and final styling.',
                includes: ['Space planning and design concept', 'Floor plans and coordinated layouts', 'Lighting and material specification', 'Furniture and finish coordination', 'Turnkey project guidance']
            },
            'interior-decoration': {
                name: 'Interior Decoration',
                image: 'assets/interior-decoration.jpeg',
                description: 'Refined decorative curation using furniture, artwork, accessories, textiles and finishing details to complete the space.',
                includes: ['Furniture and accessory selection', 'Artwork and decorative curation', 'Textile and soft furnishing direction', 'Styling and placement', 'Final presentation details']
            },
            'space-planning': {
                name: 'Space Planning',
                image: 'https://coohom-biz-sg-s3.coohom.com/ins/static/case/planificacion-espacios-3d-1774788354292594300.jpg?processFlag=true&x-oss-process=image%2Fformat%2Cwebp',
                description: 'Thoughtful room layouts and circulation planning that balance function, proportion, comfort and visual flow.',
                includes: ['Room layout planning', 'Furniture placement and circulation', 'Functional zoning', 'Proportion and flow review', 'Coordinated space recommendations']
            },
            '3d-visualization': {
                name: '3D Visualization',
                image: 'https://coohom-biz-sg-s3.coohom.com/ins/static/case/interior-design-software-render-workflow-1774098598162191100.jpg?processFlag=true&x-oss-process=image%2Fformat%2Cwebp',
                description: 'Photorealistic 3D visuals that help you see the proposed design, materials, lighting and atmosphere before execution.',
                includes: ['Photorealistic 3D interior renders', 'Material and finish visualization', 'Lighting and atmosphere studies', 'Design presentation views', 'Visualization-led design review']
            },
            'furniture-custom-work': {
                name: 'Furniture & Custom Work',
                image: 'https://spacematch.ae/_next/image?q=75&url=%2Fabout%2Fbespoke_cta3.webp&w=3840',
                description: 'Bespoke furniture and custom pieces designed around your space, proportions, lifestyle and preferred finishes.',
                includes: ['Custom furniture concept', 'Bespoke sofa and seating work', 'Dining and console pieces', 'Custom upholstery and finishes', 'Fabrication coordination']
            },
            'renovation': {
                name: 'Renovation',
                image: 'assets/renovation.jpeg',
                description: 'Interior renovation and remodelling support to transform existing spaces through coordinated upgrades and detailing.',
                includes: ['Space reconfiguration', 'Finish and surface upgrades', 'Architectural detailing', 'Electrical and lighting coordination', 'Renovation project guidance']
            },
            'interior-consultation': {
                name: 'Interior Consultation',
                image: 'https://coohom-biz-sg-s3.coohom.com/ins/static/case/interior-design-pricing-consultation-1775465825575426900.jpg',
                description: 'Focused design guidance, on-site review and practical recommendations to help you make confident interior decisions.',
                includes: ['Interior design consultation', 'On-site space review', 'Material and finish direction', 'Layout and styling recommendations', 'Actionable design guidance']
            }
        };

        function openServiceDetail(serviceId) {
            const service = signatureServices[serviceId];
            if (!service) return;

            const message = encodeURIComponent(`Hello YOU & I CREATION, I am interested in your ${service.name} service.`);
            const content = document.getElementById('serviceDetailContent');
            content.innerHTML = `
                <div class="rounded-2xl overflow-hidden border border-champagne-500/30 h-64 sm:h-96">
                    <img src="${service.image}" alt="${service.name}" class="w-full h-full object-cover">
                </div>
                <div class="space-y-5">
                    <div>
                        <span class="text-[10px] uppercase tracking-widest font-bold gold-gradient-text">Signature Service</span>
                        <h2 class="font-serif text-3xl sm:text-4xl font-bold text-white mt-1">${service.name}</h2>
                        <p class="text-sm text-champagne-300/70 font-light mt-4 leading-relaxed">${service.description}</p>
                    </div>
                    <div>
                        <h3 class="font-serif text-xl font-bold text-white mb-3">What This Service Includes</h3>
                        <ul class="space-y-2 text-xs text-champagne-300/80">
                            ${service.includes.map(item => `<li class="flex items-start space-x-2"><i class="fas fa-check text-champagne-400 mt-0.5"></i><span>${item}</span></li>`).join('')}
                        </ul>
                    </div>
                    <div class="pt-4 border-t border-champagne-500/20">
                        <button onclick="window.open('https://wa.me/2347047751718?text=${message}', '_blank')" class="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-champagne-500 to-champagne-600 hover:from-champagne-400 hover:to-champagne-500 text-black font-semibold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg">
                            Request This Service
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('serviceDetailModal').classList.remove('hidden');
        }

        function closeServiceDetailModal() {
            document.getElementById('serviceDetailModal').classList.add('hidden');
        }

        function openProductDetail(id) {
            const prod = appState.products.find(p => p.id === id);
            if (!prod) return;

            const content = document.getElementById('productDetailContent');
            content.innerHTML = `
                <div class="rounded-2xl overflow-hidden border border-champagne-500/30 h-80">
                    <img src="${prod.image}" alt="${prod.name}" class="w-full h-full object-cover">
                </div>
                <div class="space-y-5 flex flex-col justify-between">
                    <div>
                        <span class="text-[10px] uppercase tracking-widest font-bold gold-gradient-text">${prod.category}</span>
                        <h2 class="font-serif text-2xl font-bold text-white mt-1">${prod.name}</h2>
                        <div class="font-serif text-2xl font-bold gold-gradient-text mt-3">${formatPrice(prod.priceNGN)}</div>
                        <p class="text-xs text-champagne-300/70 font-light mt-4 leading-relaxed">${prod.description}</p>

                        <!-- Finish Options -->
                        <div class="mt-6 space-y-2">
                            <label class="block text-[11px] font-semibold uppercase text-champagne-400">Select Material Finish</label>
                            <div class="flex space-x-2">
                                <button class="px-3 py-1.5 rounded-lg border border-champagne-400 bg-champagne-500/20 text-champagne-400 text-xs font-bold">Italian Velvet</button>
                                <button class="px-3 py-1.5 rounded-lg border border-champagne-500/20 bg-espresso-900 text-champagne-300 text-xs">Fluted Walnut</button>
                                <button class="px-3 py-1.5 rounded-lg border border-champagne-500/20 bg-espresso-900 text-champagne-300 text-xs">Bouclé</button>
                            </div>
                        </div>
                    </div>

                    <div class="flex space-x-3 pt-4 border-t border-champagne-500/20">
                        <button onclick="addToCart('${prod.id}'); closeProductDetailModal();" class="flex-1 py-3 bg-champagne-500/20 hover:bg-champagne-500 hover:text-black border border-champagne-400 text-champagne-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all">
                            Add To Cart
                        </button>
                        <button onclick="addToCart('${prod.id}'); closeProductDetailModal(); openCheckoutModal();" class="flex-1 py-3 bg-gradient-to-r from-champagne-500 to-champagne-600 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg">
                            Buy Now
                        </button>
                    </div>
                </div>
            `;
            document.getElementById('productDetailModal').classList.remove('hidden');
        }

        function closeProductDetailModal() {
            document.getElementById('productDetailModal').classList.add('hidden');
        }

        function addToCart(id, quantity = 1) {
            // Product IDs can arrive from Supabase as UUIDs/strings. Normalize both
            // sides so the cart button always finds the product reliably.
            const normalizedId = String(id ?? '');
            const prod = appState.products.find(p => String(p?.id ?? '') === normalizedId);
            if (!prod) {
                console.warn('Add to cart: product not found', { id: normalizedId, products: appState.products });
                showToast('This product could not be added. Please refresh the page and try again.');
                return;
            }

            const qty = Math.max(1, Math.min(100, Number(quantity) || 1));
            const existing = appState.cart.find(c => String(c?.id ?? '') === normalizedId);
            if (existing) {
                existing.qty = Math.min(100, Number(existing.qty) + qty);
            } else {
                appState.cart.push({ ...prod, id: normalizedId, qty });
            }

            updateCartDrawerUI();
            showToast(`${qty} piece${qty === 1 ? '' : 's'} of ${prod.name} added to cart`);
        }

        function getCartSubtotalNGN() {
            return Number(appState.cart.reduce((sum, item) => {
                return sum + (Number(item.priceNGN) * Number(item.qty));
            }, 0).toFixed(0));
        }

        function updateCartDrawerUI() {
            const badge = document.getElementById('cartBadge');
            const drawerItems = document.getElementById('cartDrawerItems');
            const subtotalElem = document.getElementById('cartSubtotal');
            const totalElem = document.getElementById('cartTotal');
            const deliveryElem = document.getElementById('cartDeliveryFee');
            const checkoutBtn = document.getElementById('cartCheckoutBtn');

            const totalItems = appState.cart.reduce((sum, item) => sum + Number(item.qty), 0);
            badge.innerText = totalItems;

            if (appState.cart.length === 0) {
                drawerItems.innerHTML = `<div class="text-center py-12 text-champagne-300/40 text-xs">Your shopping cart is currently empty.</div>`;
                subtotalElem.innerText = formatPrice(0);
                totalElem.innerText = formatPrice(0);
                deliveryElem.innerText = 'To be confirmed';
                checkoutBtn.disabled = true;
                return;
            }

            checkoutBtn.disabled = false;
            drawerItems.innerHTML = '';

            appState.cart.forEach(item => {
                drawerItems.innerHTML += `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-espresso-800 border border-champagne-500/20">
                        <div class="flex items-center space-x-3">
                            <img src="${item.image}" alt="${item.name}" class="w-12 h-12 rounded-lg object-cover">
                            <div>
                                <h4 class="font-serif text-xs font-bold text-white">${item.name}</h4>
                                <span class="text-[11px] gold-gradient-text font-bold">${formatPrice(item.priceNGN)}</span>
                            </div>
                        </div>
                        <div class="text-[9px] uppercase tracking-wider text-champagne-300/50 mr-1">Pieces</div>
                        <div class="flex items-center space-x-2">
                            <button onclick="changeQty('${item.id}', -1)" class="w-6 h-6 rounded bg-espresso-900 border border-champagne-500/30 text-xs text-champagne-300 flex items-center justify-center">-</button>
                            <span class="text-xs font-bold text-white">${item.qty}</span>
                            <button onclick="changeQty('${item.id}', 1)" class="w-6 h-6 rounded bg-espresso-900 border border-champagne-500/30 text-xs text-champagne-300 flex items-center justify-center">+</button>
                        </div>
                    </div>
                `;
            });

            const subtotalNGN = getCartSubtotalNGN();
            subtotalElem.innerText = formatPrice(subtotalNGN);
            deliveryElem.innerText = 'To be confirmed';
            totalElem.innerText = formatPrice(subtotalNGN);
        }

        function changeQty(id, delta) {
            const item = appState.cart.find(c => c.id === id);
            if (!item) return;
            item.qty += delta;
            if (item.qty <= 0) appState.cart = appState.cart.filter(c => c.id !== id);
            updateCartDrawerUI();
            updateCheckoutTotals();
        }

        function toggleCartDrawer() {
            document.getElementById('cartDrawer').classList.toggle('hidden');
        }

        function openCheckoutModal() {
            document.getElementById('cartDrawer').classList.add('hidden');
            updateCheckoutTotals();
            document.getElementById('checkoutModal').classList.remove('hidden');
        }

        function closeCheckoutModal() {
            document.getElementById('checkoutModal').classList.add('hidden');
        }

        function updateCheckoutTotals() {
            const subtotalNGN = getCartSubtotalNGN();
            const grandTotalElem = document.getElementById('chkGrandTotal');
            const deliveryDisplay = document.getElementById('chkDeliveryDisplay');
            if (grandTotalElem) grandTotalElem.innerText = formatPrice(subtotalNGN);
            if (deliveryDisplay) deliveryDisplay.innerText = 'Delivery fee to be confirmed separately';
        }

        function setCheckoutPayMethod(method) {
            appState.checkoutPayMethod = method;
            const cardActive = method === 'card';
            document.getElementById('payCardBtn').className = cardActive ? 'p-3 rounded-xl border border-champagne-400 bg-champagne-500/20 text-champagne-400 font-bold text-center' : 'p-3 rounded-xl border border-champagne-500/30 bg-espresso-900 text-champagne-300 font-bold text-center';
            document.getElementById('payTransferBtn').className = !cardActive ? 'p-3 rounded-xl border border-champagne-400 bg-champagne-500/20 text-champagne-400 font-bold text-center' : 'p-3 rounded-xl border border-champagne-500/30 bg-espresso-900 text-champagne-300 font-bold text-center';
            document.getElementById('checkoutCardArea').classList.toggle('hidden', !cardActive);
            document.getElementById('checkoutTransferArea').classList.toggle('hidden', cardActive);
            const btn = document.getElementById('chkSubmitBtn');
            btn.innerText = cardActive ? 'Pay by Card' : 'I Have Made the Transfer';
        }

        function sanitizePhoneNumber(value) {
            // Flutterwave requires a numeric phone_number value. This strips spaces,
            // + signs, brackets, hyphens and other non-numeric characters.
            return String(value || '').replace(/\D/g, '');
        }

        async function processFinalPayment() {
            const btn = document.getElementById('chkSubmitBtn');
            const name = document.getElementById('chkName').value.trim();
            const email = document.getElementById('chkEmail').value.trim();
            const address = document.getElementById('chkAddress').value.trim();
            const state = document.getElementById('chkState').value.trim();
            const city = document.getElementById('chkCity').value.trim();
            const location = `${city}, ${state}`;
            const rawPhone = document.getElementById('chkPhone').value.trim();
            const phone = sanitizePhoneNumber(rawPhone);
            const selectedPaymentMethod = appState.checkoutPayMethod === 'transfer' ? 'manual_transfer' : 'card';

            if (!name || !email || !address || !state || !city || !location) {
                showToast('Please complete your name, email, phone, state, city and delivery address.');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast('Please enter a valid email address.');
                return;
            }

            if (!/^\d{7,15}$/.test(phone)) {
                showToast('Please enter a valid phone number using numbers only.');
                return;
            }

            if (!appState.cart.length) {
                showToast('Your cart is empty.');
                return;
            }

            const localSubtotalNGN = getCartSubtotalNGN();
            updateCheckoutTotals();

            if (!Number.isFinite(localSubtotalNGN) || localSubtotalNGN <= 0) {
                showToast('Unable to calculate a valid order total. Please review your cart.');
                return;
            }

            btn.innerText = appState.checkoutPayMethod === 'transfer' ? 'Submitting Transfer...' : 'Preparing Card Payment...';
            btn.disabled = true;

            try {
                // The server recalculates the product total in NGN. Delivery is confirmed separately.
                const paymentResponse = await fetch('/api/create-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: appState.cart.map(item => ({
                            id: item.id,
                            qty: item.qty
                        })),
                        location,
                        state,
                        city,
                        currency: 'NGN',
                        payment_method: selectedPaymentMethod,
                        customer: {
                            name,
                            email,
                            phone,
                            address,
                            state,
                            city
                        }
                    })
                });

                const paymentData = await paymentResponse.json();

                if (!paymentResponse.ok || !paymentData.tx_ref) {
                    throw new Error(paymentData.error || 'Unable to prepare the payment.');
                }

                if (selectedPaymentMethod === 'manual_transfer') {
                    if (!paymentData.manual_transfer || !paymentData.tracking_id) {
                        throw new Error('Unable to create your bank-transfer order.');
                    }
                    saveCustomerOrder({
                        id: paymentData.tracking_id,
                        customer: name,
                        item: appState.cart[0]?.name || 'Order',
                        totalNGN: Number(paymentData.amount_ngn),
                        status: 'Payment Pending',
                        date: 'Just Now',
                        progressStep: 0
                    });
                    appState.cart = [];
                    localStorage.removeItem('youI_pending_payment');
                    updateCartDrawerUI();
                    renderAccountOrders();
                    renderAdminOrdersTable();
                    closeCheckoutModal();
                    btn.innerText = 'I Have Made the Transfer';
                    btn.disabled = false;
                    showToast(`Transfer details received. Tracking Ref: ${paymentData.tracking_id}`);
                    return;
                }

                // Flutterwave must receive a real JS Number, never formatted currency text.
                const expectedAmount = Number(paymentData.amount);
                const expectedCurrency = String(paymentData.currency || '').trim().toUpperCase();
                const txRef = String(paymentData.tx_ref || '').trim();
                const serverGrandTotalNGN = Number(paymentData.amount_ngn);
                const trackingId = String(paymentData.tracking_id || '').trim();
                if (!trackingId) throw new Error('Unable to create an order tracking reference.');

                if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
                    throw new Error('Invalid payment amount returned by the server.');
                }

                if (!/^[A-Z]{3}$/.test(expectedCurrency)) {
                    throw new Error('Invalid payment currency returned by the server.');
                }

                if (!txRef) {
                    throw new Error('Invalid Flutterwave transaction reference.');
                }

                // Keep the UI and the server calculation aligned. If they differ, stop
                // instead of charging a customer an unexpected amount.
                if (!Number.isFinite(serverGrandTotalNGN) || Math.abs(serverGrandTotalNGN - localSubtotalNGN) > 0) {
                    throw new Error('The order total changed. Please refresh your checkout and try again.');
                }

                // Flutterwave Standard returns a hosted checkout link created server-side.
                // Redirecting to that link ensures the transaction is created under the
                // Flutterwave account associated with FLW_SECRET_KEY on Vercel.
                if (!paymentData.payment_link) {
                    throw new Error('Flutterwave did not return a secure payment link.');
                }

                localStorage.setItem('youI_pending_payment', JSON.stringify({
                    tx_ref: txRef,
                    amount: expectedAmount,
                    currency: expectedCurrency,
                    customer: name,
                    firstItem: appState.cart[0]?.name || 'Bespoke Furnishing',
                    tracking_id: trackingId
                }));
                window.location.href = paymentData.payment_link;

                closeCheckoutModal();
            } catch (error) {
                console.error('Flutterwave checkout error:', error);
                btn.innerText = appState.checkoutPayMethod === 'transfer' ? 'I Have Made the Transfer' : 'Pay by Card';
                btn.disabled = false;
                showToast(error.message || 'Unable to start payment. Please try again.');
            }
        }

        function setQuoteSpace(type, baseRate) {
            appState.quoteSpace = type;
            appState.quoteBasePrice = baseRate;

            const btns = document.querySelectorAll('.qspace-btn');
            btns.forEach(b => b.className = 'qspace-btn p-3 rounded-xl border border-champagne-500/20 bg-espresso-900 text-champagne-300 text-xs font-semibold flex flex-col items-center justify-center space-y-1 hover:border-champagne-400 transition-all');
            document.getElementById(`qspace-${type}`).className = 'qspace-btn active p-3 rounded-xl border border-champagne-400 bg-champagne-500/10 text-champagne-400 text-xs font-semibold flex flex-col items-center justify-center space-y-1 transition-all';

            calculateQuote();
        }

        function calculateQuote() {
            const sqftInput = document.getElementById('quoteSqftRange');
            if (!sqftInput) return;

            appState.quoteSqft = parseInt(sqftInput.value);
            document.getElementById('quoteSqftDisplay').innerText = `${appState.quoteSqft} sq ft`;

            const styleVal = parseFloat(document.getElementById('quoteStyleSelect').value || '1.3');

            let additionsCost = 0;
            if (document.getElementById('qadd-fluted').checked) additionsCost += 2500;
            if (document.getElementById('qadd-lighting').checked) additionsCost += 1800;
            if (document.getElementById('qadd-drapes').checked) additionsCost += 3200;

            const baseCostNGN = appState.quoteSqft * appState.quoteBasePrice * styleVal;
            const minTotalNGN = Math.round(baseCostNGN + additionsCost);
            const maxTotalNGN = Math.round(minTotalNGN * 1.15);

            document.getElementById('qsumBase').innerText = formatPrice(appState.quoteBasePrice) + ' / sq ft';
            document.getElementById('qsumSqft').innerText = `${appState.quoteSqft} sq ft`;
            document.getElementById('qsumAdditions').innerText = formatPrice(additionsCost);
            document.getElementById('quoteTotalDisplay').innerText = `${formatPrice(minTotalNGN)} - ${formatPrice(maxTotalNGN)}`;
        }

        function requestFormalQuote() {
            showToast('Formal 3D Visualization Proposal Request Submitted!');
        }

        function scrollToQuoteCalculator() {
            const el = document.getElementById('quoteCalculatorSection');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }

        // Real order tracking: the tracking reference is looked up on the server/Supabase.
        async function searchTrackingStatus() {
            const input = document.getElementById('trackingIdInput');
            const display = document.getElementById('trackingResultDisplay');
            const searchId = String(input?.value || '').trim().toUpperCase();
            if (!display) return;
            if (!searchId) {
                display.innerHTML = `<div class="text-center py-8 text-champagne-300/50 text-xs">Enter your tracking ID to check your order.</div>`;
                return;
            }

            display.innerHTML = `<div class="text-center py-8 text-champagne-300/60 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>Checking your order...</div>`;
            try {
                const response = await fetch(`/api/orders?tracking_id=${encodeURIComponent(searchId)}`, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok || !data.order) throw new Error(data.error || 'No order found.');
                const order = data.order;
                const steps = ['Paid', 'Processing', 'Ready for Delivery', 'Out for Delivery', 'Delivered'];
                const currentStep = Math.max(0, Math.min(5, Number(order.progress_step || 0)));
                let stepsHTML = '';
                steps.forEach((stepName, i) => {
                    const completed = i < currentStep;
                    const active = i === currentStep - 1;
                    stepsHTML += `
                        <div class="flex items-center space-x-4 ${i < steps.length - 1 ? 'pb-6' : ''}">
                            <div class="w-9 h-9 rounded-full border ${completed ? 'border-champagne-400 bg-champagne-500 text-black' : 'border-champagne-500/30 bg-espresso-900 text-champagne-300/40'} flex items-center justify-center text-xs font-bold">
                                ${completed ? '<i class="fas fa-check"></i>' : (i + 1)}
                            </div>
                            <div>
                                <div class="text-sm font-semibold ${active ? 'text-champagne-400' : 'text-white'}">${stepName}</div>
                                ${active ? '<div class="text-[10px] uppercase tracking-widest text-champagne-300/50 mt-1">Current status</div>' : ''}
                            </div>
                        </div>`;
                });

                display.innerHTML = `
                    <div class="space-y-7">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <span class="text-[10px] uppercase tracking-widest text-champagne-300/50">Tracking Reference</span>
                                <div class="font-mono text-lg font-bold text-champagne-400 mt-1">${order.tracking_id}</div>
                            </div>
                            <div class="text-left sm:text-right">
                                <span class="text-[10px] uppercase tracking-widest text-champagne-300/50">Current Status</span>
                                <div class="text-sm font-bold text-white mt-1">${order.status}</div>
                            </div>
                        </div>
                        <div class="border border-champagne-500/20 rounded-2xl p-5 bg-espresso-900/40">
                            <div class="text-xs text-champagne-300/70">${order.item_summary || 'YOU & I CREATION order'}</div>
                            <div class="text-[11px] text-champagne-300/50 mt-2">Order placed ${new Date(order.created_at).toLocaleDateString()}</div>
                        </div>
                        <div class="space-y-1">${stepsHTML}</div>
                    </div>`;
            } catch (error) {
                display.innerHTML = `<div class="text-center py-8 text-champagne-300/50 text-xs">${error.message || 'No order found with that tracking ID.'}</div>`;
            }
        }

        function getCustomerOrders() {
            try {
                const raw = localStorage.getItem('youI_customer_orders');
                const orders = raw ? JSON.parse(raw) : [];
                return Array.isArray(orders) ? orders : [];
            } catch (e) {
                return [];
            }
        }

        function saveCustomerOrder(order) {
            const orders = getCustomerOrders();
            const exists = orders.some(o => String(o.id) === String(order.id));
            if (!exists) orders.unshift(order);
            localStorage.setItem('youI_customer_orders', JSON.stringify(orders.slice(0, 50)));
        }

        function loadCustomerProfile() {
            try {
                const raw = localStorage.getItem('youI_customer_profile');
                return raw ? JSON.parse(raw) : {};
            } catch (e) {
                return {};
            }
        }

        function updateCustomerProfileDisplay(profile) {
            const name = String(profile.name || '').trim();
            const initials = name ? name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') : '?';
            const initialsEl = document.getElementById('accountProfileInitials');
            const nameEl = document.getElementById('accountProfileNameDisplay');
            if (initialsEl) initialsEl.textContent = initials;
            if (nameEl) nameEl.textContent = name || 'Your Name';
        }

        function loadCustomerProfileIntoForm() {
            const profile = loadCustomerProfile();
            const name = document.getElementById('accountFullName');
            const email = document.getElementById('accountEmail');
            const phone = document.getElementById('accountPhone');
            if (name) name.value = profile.name || '';
            if (email) email.value = profile.email || '';
            if (phone) phone.value = profile.phone || '';
            updateCustomerProfileDisplay(profile);
        }

        function saveCustomerProfile() {
            const profile = {
                name: document.getElementById('accountFullName')?.value.trim() || '',
                email: document.getElementById('accountEmail')?.value.trim() || '',
                phone: document.getElementById('accountPhone')?.value.trim() || ''
            };
            localStorage.setItem('youI_customer_profile', JSON.stringify(profile));
            updateCustomerProfileDisplay(profile);
            showToast('Profile saved successfully.');
        }

        function renderAccountOrders() {
            const list = document.getElementById('accountOrdersList');
            if (!list) return;
            const orders = getCustomerOrders();

            if (!orders.length) {
                list.innerHTML = `
                    <div class="p-8 rounded-xl bg-espresso-900 border border-champagne-500/10 text-center">
                        <i class="fas fa-box-open text-champagne-400/60 text-2xl mb-3"></i>
                        <p class="text-sm text-champagne-300/70">No orders or project proposals yet.</p>
                        <p class="text-xs text-champagne-300/40 mt-2">Your purchases and approved project proposals will appear here.</p>
                    </div>`;
                return;
            }

            list.innerHTML = '';
            orders.forEach(ord => {
                list.innerHTML += `
                    <div class="p-4 rounded-xl bg-espresso-900 border border-champagne-500/20 flex items-center justify-between">
                        <div>
                            <div class="flex items-center space-x-2">
                                <span class="text-xs font-bold text-white font-serif">${ord.item}</span>
                                <span class="text-[10px] font-mono text-champagne-400">(${ord.id})</span>
                            </div>
                            <span class="text-[11px] text-champagne-300/60 block mt-1">${ord.date} • Total: ${formatPrice(ord.totalNGN)}</span>
                        </div>
                        <button onclick="switchTab('tracking'); document.getElementById('trackingIdInput').value='${ord.id}'; searchTrackingStatus();" class="px-3 py-1.5 rounded-lg border border-champagne-400/40 bg-champagne-500/10 text-champagne-400 text-xs font-semibold hover:bg-champagne-500 hover:text-black transition-all">
                            Track
                        </button>
                    </div>
                `;
            });
        }

        function renderProjects() {
            const grid = document.getElementById('projectsGrid');
            const empty = document.getElementById('projectsEmpty');
            if (!grid) return;
            const filter = appState.activeProjectFilter || 'all';
            const projects = (appState.projects || []).filter(p => filter === 'all' || String(p.category).toLowerCase() === filter);
            grid.innerHTML = '';
            if (!projects.length) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');
            projects.forEach(prj => {
                grid.innerHTML += `
                    <div class="glass-card rounded-2xl overflow-hidden border border-champagne-500/30 group">
                        <div class="h-64 overflow-hidden relative">
                            <img src="${prj.image}" alt="${prj.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                        </div>
                        <div class="p-6 space-y-3">
                            <span class="text-[10px] uppercase font-bold gold-gradient-text tracking-widest">${prj.category}</span>
                            <h3 class="font-serif text-xl font-bold text-white">${prj.name}</h3>
                            <p class="text-xs text-champagne-300/70 font-light leading-relaxed">${prj.desc}</p>
                        </div>
                    </div>`;
            });
        }

        function filterProjects(cat) {
            appState.activeProjectFilter = cat;
            document.querySelectorAll('.proj-btn').forEach(b => b.className = 'proj-btn px-4 py-2 rounded-full border border-champagne-500/30 bg-espresso-900 text-champagne-300 text-xs font-semibold');
            if (typeof event !== 'undefined' && event.currentTarget) event.currentTarget.className = 'proj-btn active px-4 py-2 rounded-full border border-champagne-400 bg-champagne-500 text-black text-xs font-semibold';
            renderProjects();
        }

        async function loadProjectsFromServer() {
            try {
                const r = await fetch('/api/admin-projects', { cache: 'no-store' });
                const data = await r.json();
                if (r.ok && Array.isArray(data.projects)) {
                    appState.projects = data.projects;
                    renderProjects();
                    renderAdminProjects();
                    const stat = document.getElementById('adminStatProjects');
                    if (stat) stat.textContent = `${appState.projects.length} Projects`;
                }
            } catch (e) { console.warn('Projects could not be loaded:', e); }
        }

        function renderAdminProjects() {
            const list = document.getElementById('adminProjectsList');
            if (!list) return;
            list.innerHTML = '';
            if (!appState.projects.length) {
                list.innerHTML = '<div class="col-span-full glass-card rounded-2xl p-8 text-center text-xs text-champagne-300/60">No interior projects uploaded yet.</div>';
                return;
            }
            appState.projects.forEach(prj => {
                list.innerHTML += `<div class="glass-card rounded-2xl p-4 border border-champagne-500/20 flex gap-4">
                    <img src="${prj.image}" alt="${prj.name}" class="w-24 h-24 rounded-xl object-cover">
                    <div class="flex-1 min-w-0"><h4 class="font-serif text-lg font-bold text-white truncate">${prj.name}</h4><p class="text-[10px] uppercase text-champagne-400 mt-1">${prj.category}</p><p class="text-xs text-champagne-300/60 line-clamp-2 mt-2">${prj.desc}</p></div>
                    <button onclick="deleteAdminProject('${prj.id}')" class="self-start px-3 py-2 rounded-lg border border-red-500/30 text-red-300 text-xs">Delete</button>
                </div>`;
            });
        }

        function openAdminProjectForm() { document.getElementById('adminProjectForm')?.classList.remove('hidden'); }
        function closeAdminProjectForm() { document.getElementById('adminProjectForm')?.classList.add('hidden'); }
        async function saveAdminProject() {
            const token = localStorage.getItem('youI_admin_token');
            if (!token) { openAdminLogin(); return; }
            const name = document.getElementById('adminProjectName').value.trim();
            const category = document.getElementById('adminProjectCategory').value;
            const description = document.getElementById('adminProjectDescription').value.trim();
            const file = document.getElementById('adminProjectImage').files[0];
            const btn = document.getElementById('adminProjectSaveBtn');
            if (!name || !description || !file) { showToast('Please enter the project details and choose an image.'); return; }
            btn.disabled = true; btn.innerText = 'Saving...';
            try {
                const imageDataUrl = await readProjectImageDataUrl(file);
                const r = await fetch('/api/admin-projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'create', token, project:{name,category,description}, imageDataUrl}) });
                const data = await r.json();
                if (r.status === 401) { localStorage.removeItem('youI_admin_token'); openAdminLogin(); return; }
                if (!r.ok) throw new Error(data.error || 'Unable to save project.');
                appState.projects = data.projects || [];
                renderProjects(); renderAdminProjects(); loadAdminStats(); closeAdminProjectForm();
                document.getElementById('adminProjectName').value=''; document.getElementById('adminProjectDescription').value=''; document.getElementById('adminProjectImage').value='';
                showToast('Interior project uploaded successfully.');
            } catch(e) { showToast(e.message || 'Unable to save project.'); }
            finally { btn.disabled=false; btn.innerText='Save Project'; }
        }
        async function deleteAdminProject(id) {
            if (!confirm('Delete this interior project from the portfolio?')) return;
            const token = localStorage.getItem('youI_admin_token');
            try {
                const r = await fetch('/api/admin-projects', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'delete',token,id}) });
                const data = await r.json();
                if (r.status===401) { localStorage.removeItem('youI_admin_token'); openAdminLogin(); return; }
                if (!r.ok) throw new Error(data.error || 'Unable to delete project.');
                appState.projects = data.projects || []; renderProjects(); renderAdminProjects(); loadAdminStats(); showToast('Project deleted.');
            } catch(e) { showToast(e.message || 'Unable to delete project.'); }
        }

        // Admin Portal Subtabs
        function switchAdminSubtab(subId) {
            const subs = document.querySelectorAll('.admin-subtab-content');
            subs.forEach(s => s.classList.add('hidden'));
            subs.forEach(s => s.classList.remove('block'));

            document.getElementById(`adminSub-${subId}`).classList.remove('hidden');
            document.getElementById(`adminSub-${subId}`).classList.add('block');

            const btns = document.querySelectorAll('.admin-tab-btn');
            btns.forEach(b => b.className = 'admin-tab-btn px-5 py-2.5 rounded-full border border-champagne-500/30 bg-espresso-900 text-champagne-300');
            event.currentTarget.className = 'admin-tab-btn active px-5 py-2.5 rounded-full border border-champagne-400 bg-champagne-500 text-black';
        }

        async function loadAdminStats() {
            const revEl = document.getElementById('adminStatRev');
            const projectsEl = document.getElementById('adminStatProjects');
            const pendingEl = document.getElementById('adminStatPending');
            const quotesEl = document.getElementById('adminStatQuotes');
            const catalogEl = document.getElementById('adminStatCatalog');
            if (revEl) revEl.textContent = formatPrice(0);
            if (projectsEl) projectsEl.textContent = `${Array.isArray(appState.projects) ? appState.projects.length : 0} Projects`;
            if (pendingEl) pendingEl.textContent = '0 Orders';
            if (quotesEl) quotesEl.textContent = '0 New';
            if (catalogEl) catalogEl.textContent = `${Array.isArray(appState.products) ? appState.products.length : 0} Items`;

            const token = localStorage.getItem('youI_admin_token');
            if (!token) return;
            try {
                const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const data = await r.json();
                if (!r.ok) return;
                const orders = Array.isArray(data.orders) ? data.orders : [];
                const revenue = orders.reduce((sum, ord) => sum + (Number(ord.total_ngn) || 0), 0);
                const pending = orders.filter(ord => String(ord.status || '').toLowerCase() !== 'delivered').length;
                if (revEl) revEl.textContent = formatPrice(revenue);
                if (pendingEl) pendingEl.textContent = `${pending} Orders`;
            } catch (e) {
                console.warn('Admin stats could not be loaded:', e);
            }
        }

        async function renderAdminOrdersTable() {
            const tbody = document.getElementById('adminOrdersTableBody');
            if (!tbody) return;
            const token = localStorage.getItem('youI_admin_token');
            if (!token) return;
            try {
                const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
                const data = await r.json();
                if (r.status === 401) { localStorage.removeItem('youI_admin_token'); return; }
                if (!r.ok) throw new Error(data.error || 'Unable to load orders.');
                appState.orders = (data.orders || []).map(ord => ({
                    id: ord.tracking_id,
                    customer: ord.customer_name,
                    item: ord.item_summary || 'YOU & I CREATION Order',
                    totalNGN: Number(ord.total_ngn),
                    status: ord.status,
                    date: new Date(ord.created_at).toLocaleDateString(),
                    progressStep: Number(ord.progress_step || 0)
                }));
                tbody.innerHTML = '';
                appState.orders.forEach(ord => {
                    tbody.innerHTML += `
                        <tr>
                            <td class="p-4 font-mono font-bold text-champagne-400">${ord.id}</td>
                            <td class="p-4 font-medium text-white">${ord.customer}</td>
                            <td class="p-4 text-champagne-300/80">${ord.item}</td>
                            <td class="p-4 font-bold gold-gradient-text">${formatPrice(ord.totalNGN)}</td>
                            <td class="p-4"><span class="px-2.5 py-1 rounded-full bg-champagne-500/20 text-champagne-400 border border-champagne-400/30 text-[10px] font-bold">${ord.status}</span></td>
                            <td class="p-4 text-right">
                                <select onchange="updateOrderStatusFromAdmin('${ord.id}', this.value)" class="bg-espresso-900 border border-champagne-500/30 rounded-lg p-1.5 text-xs text-white focus:outline-none">
                                    <option value="Paid" ${ord.status==='Paid'?'selected':''}>Paid</option>
                                    <option value="Processing" ${ord.status==='Processing'?'selected':''}>Processing</option>
                                    <option value="Ready for Delivery" ${ord.status==='Ready for Delivery'?'selected':''}>Ready for Delivery</option>
                                    <option value="Out for Delivery" ${ord.status==='Out for Delivery'?'selected':''}>Out for Delivery</option>
                                    <option value="Delivered" ${ord.status==='Delivered'?'selected':''}>Delivered</option>
                                </select>
                            </td>
                        </tr>`;
                });
            } catch (e) {
                console.error('Admin orders load error:', e);
                tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-xs text-red-300">Unable to load live orders.</td></tr>`;
            }
        }

        async function updateOrderStatusFromAdmin(id, newStatus) {
            const token = localStorage.getItem('youI_admin_token');
            try {
                const r = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'update-status', token, tracking_id: id, status: newStatus })
                });
                const data = await r.json();
                if (r.status === 401) { localStorage.removeItem('youI_admin_token'); openAdminLogin(); return; }
                if (!r.ok) throw new Error(data.error || 'Unable to update order status.');
                showToast(`Order ${id} status updated to ${newStatus}`);
                await renderAdminOrdersTable();
                await loadAdminStats();
            } catch (e) {
                showToast(e.message || 'Unable to update order status.');
            }
        }

        // Toast Helper
        function showToast(msg) {
            const toast = document.getElementById('toast');
            document.getElementById('toastMsg').innerText = msg;
            toast.classList.remove('hidden');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }

        async function handleFlutterwaveCallback() {
            const params = new URLSearchParams(window.location.search);
            const status = String(params.get('status') || '').toLowerCase();
            const txRef = String(params.get('tx_ref') || '').trim();
            const transactionId = String(params.get('transaction_id') || '').trim();
            const pendingRaw = localStorage.getItem('youI_pending_payment');

            if (!txRef || !transactionId || !pendingRaw) return;

            try {
                const pending = JSON.parse(pendingRaw);
                if (status !== 'successful' || pending.tx_ref !== txRef) {
                    showToast('Payment was not completed. Your order was not marked as paid.');
                    return;
                }

                const response = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transaction_id: transactionId,
                        tx_ref: txRef,
                        expected_amount: Number(pending.amount),
                        expected_currency: 'NGN'
                    })
                });
                const data = await response.json();
                if (!response.ok || !data.verified) throw new Error(data.error || 'Payment could not be verified.');

                const newId = data.tracking_id || data.order?.tracking_id;
                if (!newId) throw new Error('Payment was verified but no tracking reference was returned.');
                const customerOrder = {
                    id: newId,
                    customer: pending.customer,
                    item: pending.firstItem,
                    totalNGN: Number(pending.amount),
                    status: 'Paid',
                    date: 'Just Now',
                    progressStep: 1
                };
                saveCustomerOrder(customerOrder);
                appState.cart = [];
                localStorage.removeItem('youI_pending_payment');
                updateCartDrawerUI();
                renderAccountOrders();
                renderAdminOrdersTable();
                document.getElementById('trackingIdInput').value = newId;
                showToast(`Payment Successful! Tracking Ref: ${newId}`);
                history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
                console.error('Flutterwave callback verification error:', error);
                showToast('Payment could not be verified. Please contact support before trying again.');
            }
        }

        // Initialize Window
        window.onload = function() {
            renderHomeFeatured();
            renderProductsCatalog();
            loadProductsFromServer();
            loadProjectsFromServer();
            renderProjects();
            calculateQuote();
            loadCustomerProfileIntoForm();
            renderAccountOrders();
            searchTrackingStatus();
            handleFlutterwaveCallback();
        };
    