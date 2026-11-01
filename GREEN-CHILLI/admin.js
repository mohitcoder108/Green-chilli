
/* =====================================================
   GREEN CHILLI - COMPLETE ADMIN DASHBOARD
   Authentication + Products + Orders + Notifications
===================================================== */

// =====================================================
// 1. CONFIGURATION
// =====================================================

const ADMIN_USER_ID = "2af4dbb0-c8db-4503-9e92-683fd78c27f2";

const IMAGE_BUCKET = "product-images";

const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "completed",
    "cancelled"
];

// =====================================================
// 2. GLOBAL VARIABLES
// =====================================================

let currentProducts = [];
let currentOrders = [];

let editingProductId = null;
let selectedImageFile = null;
let previewObjectURL = null;

let knownOrderIds = new Set();
let orderRealtimeChannel = null;
let audioContext = null;
let notificationsInitialized = false;

// =====================================================
// 3. HTML ELEMENTS
// =====================================================

const getElement = id => document.getElementById(id);

const loginSection = getElement("loginSection");
const dashboardSection = getElement("dashboardSection");

const loginForm = getElement("loginForm");
const loginButton = getElement("loginButton");
const loginMessage = getElement("loginMessage");

const logoutButton = getElement("logoutButton");

const productForm = getElement("productForm");
const productMessage = getElement("productMessage");
const productTableBody = getElement("productTableBody");

const productImage = getElement("productImage");
const imagePreview = getElement("imagePreview");

const productSearch = getElement("productSearch");

// =====================================================
// 4. HELPER FUNCTIONS
// =====================================================

function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;

    element.style.color =
        type === "success" ? "#a6d65e" : "#ff7777";
}

function setLoading(button, loading, originalText) {
    if (!button) return;

    button.disabled = loading;

    button.textContent = loading
        ? "Please wait..."
        : originalText;
}

function formatPrice(price) {
    return "₹" + Number(price).toLocaleString("en-IN");
}

function formatDate(date) {
    if (!date) return "N/A";

    return new Date(date).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function showLogin() {
    loginSection?.classList.remove("hidden");
    dashboardSection?.classList.add("hidden");
}

function showDashboardSection() {
    loginSection?.classList.add("hidden");
    dashboardSection?.classList.remove("hidden");
}

// =====================================================
// 5. ADMIN AUTHENTICATION
// =====================================================

async function checkAdminSession() {
    const { data, error } =
        await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        showLogin();
        return;
    }

    const user = data.session?.user;

    if (!user) {
        showLogin();
        return;
    }

    if (user.id !== ADMIN_USER_ID) {
        await supabaseClient.auth.signOut();
        showLogin();

        showMessage(
            loginMessage,
            "Unauthorized Admin Account."
        );

        return;
    }

    await showDashboard();
}

// LOGIN

loginForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const email = getElement("adminEmail")?.value.trim();
    const password = getElement("adminPassword")?.value;

    if (!email || !password) {
        showMessage(
            loginMessage,
            "Email और Password भरें।"
        );
        return;
    }

    setLoading(
        loginButton,
        true,
        "Login to Dashboard →"
    );

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        if (data.user.id !== ADMIN_USER_ID) {
            await supabaseClient.auth.signOut();

            showMessage(
                loginMessage,
                "आपको Admin Dashboard की अनुमति नहीं है।"
            );

            return;
        }

        showMessage(
            loginMessage,
            "Login Successful!",
            "success"
        );

        await showDashboard();

    } catch (error) {
        showMessage(loginMessage, error.message);

    } finally {
        setLoading(
            loginButton,
            false,
            "Login to Dashboard →"
        );
    }
});

// LOGOUT

logoutButton?.addEventListener("click", async () => {
    stopOrderRealtime();

    const { error } =
        await supabaseClient.auth.signOut();

    if (error) {
        alert(error.message);
        return;
    }

    currentProducts = [];
    currentOrders = [];
    knownOrderIds.clear();

    notificationsInitialized = false;

    if (loginForm) loginForm.reset();

    showLogin();
});

// =====================================================
// 6. DASHBOARD
// =====================================================

async function showDashboard() {
    showDashboardSection();

    openPage("overview");

    await loadProducts();

    await initializeOrderNotifications();
}

// =====================================================
// 7. PAGE NAVIGATION
// =====================================================

function openPage(pageName) {
    document.querySelectorAll(".admin-page").forEach(page => {
        page.classList.add("hidden");
    });

    const selectedPage = getElement(pageName + "Page");

    if (selectedPage) {
        selectedPage.classList.remove("hidden");
    }

    document.querySelectorAll("[data-page]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === pageName
        );
    });

    const titles = {
        overview: "Dashboard Overview",
        products: "Manage Products",
        orders: "Customer Orders",
        settings: "Restaurant Settings"
    };

    const pageTitle = getElement("pageTitle");

    if (pageTitle) {
        pageTitle.textContent =
            titles[pageName] || "Dashboard";
    }

    if (pageName === "orders") {
        loadOrders();
    }
}

document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
        openPage(button.dataset.page);
    });
});

// =====================================================
// 8. ADD PRODUCT BUTTON
// =====================================================

getElement("addProductButton")?.addEventListener("click", () => {
    resetProductForm();

    getElement("productFormContainer")
        ?.classList.remove("hidden");

    openPage("products");

    getElement("productFormContainer")?.scrollIntoView({
        behavior: "smooth"
    });
});

// =====================================================
// 9. IMAGE PREVIEW
// =====================================================

function setImagePreview(url) {
    if (!imagePreview) return;

    imagePreview.innerHTML = "";

    const img = document.createElement("img");

    img.src = url;
    img.alt = "Product Preview";

    img.style.maxWidth = "150px";
    img.style.maxHeight = "150px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";

    imagePreview.appendChild(img);

    imagePreview.classList.remove("hidden");
}

function clearImagePreview() {
    if (previewObjectURL) {
        URL.revokeObjectURL(previewObjectURL);
        previewObjectURL = null;
    }

    if (imagePreview) {
        imagePreview.innerHTML = "";
        imagePreview.classList.add("hidden");
    }
}

productImage?.addEventListener("change", () => {
    const file = productImage.files[0];

    selectedImageFile = null;

    if (!file) return;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        showMessage(
            productMessage,
            "केवल JPG, PNG या WebP Image चुनें।"
        );

        productImage.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showMessage(
            productMessage,
            "Image का Size 5 MB से कम होना चाहिए।"
        );

        productImage.value = "";
        return;
    }

    selectedImageFile = file;

    clearImagePreview();

    previewObjectURL = URL.createObjectURL(file);

    setImagePreview(previewObjectURL);

    showMessage(productMessage, "");
});

// =====================================================
// 10. UPLOAD PRODUCT IMAGE
// =====================================================

async function uploadProductImage(file) {
    const extension = file.name.split(".").pop().toLowerCase();

    const filePath =
        crypto.randomUUID() + "." + extension;

    const { error } = await supabaseClient.storage
        .from(IMAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false
        });

    if (error) throw error;

    const { data } = supabaseClient.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;
}

// =====================================================
// 11. LOAD PRODUCTS
// =====================================================

async function loadProducts() {
    if (!productTableBody) return;

    productTableBody.innerHTML =
        '<tr><td colspan="6">Loading Products...</td></tr>';

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);

        productTableBody.innerHTML =
            '<tr><td colspan="6">Products Load Failed.</td></tr>';

        showMessage(productMessage, error.message);

        return;
    }

    currentProducts = data || [];

    renderProducts(currentProducts);

    updateDashboardStats();
}

// =====================================================
// 12. RENDER PRODUCTS
// =====================================================

function renderProducts(products) {
    if (!productTableBody) return;

    productTableBody.innerHTML = "";

    if (products.length === 0) {
        productTableBody.innerHTML =
            '<tr><td colspan="6">No Products Found.</td></tr>';
        return;
    }

    products.forEach(product => {
        const row = document.createElement("tr");

        const imageCell = document.createElement("td");
        const image = document.createElement("img");

        image.src = product.image_url || "";
        image.alt = product.name || "Product";
        image.width = 55;
        image.height = 55;

        image.style.objectFit = "cover";
        image.style.borderRadius = "8px";

        imageCell.appendChild(image);

        const nameCell = document.createElement("td");
        nameCell.textContent = product.name;

        const categoryCell = document.createElement("td");
        categoryCell.textContent = product.category;

        const priceCell = document.createElement("td");
        priceCell.textContent = formatPrice(product.price);

        const stockCell = document.createElement("td");
        const stockBadge = document.createElement("span");

        stockBadge.textContent = product.is_available
            ? "Available"
            : "Out of Stock";

        stockBadge.className = product.is_available
            ? "stock-available"
            : "stock-out";

        stockCell.appendChild(stockBadge);

        const actionCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editProduct(product.id);
        });

        const stockButton = document.createElement("button");

        stockButton.textContent = product.is_available
            ? "Mark Out"
            : "Mark Available";

        stockButton.addEventListener("click", () => {
            toggleStock(product.id, product.is_available);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteProduct(product.id);
        });

        actionCell.append(
            editButton,
            stockButton,
            deleteButton
        );

        row.append(
            imageCell,
            nameCell,
            categoryCell,
            priceCell,
            stockCell,
            actionCell
        );

        productTableBody.appendChild(row);
    });
}

// =====================================================
// 13. ADD / UPDATE PRODUCT
// =====================================================

productForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const name = getElement("productName")?.value.trim();

    const price = Number(getElement("productPrice")?.value);

    const category = getElement("productCategory")?.value;

    const description =
        getElement("productDescription")?.value.trim();

    const isAvailable =
        getElement("productStock")?.value === "true";

    if (
        !name ||
        !category ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        showMessage(
            productMessage,
            "कृपया सभी जरूरी जानकारी सही भरें।"
        );
        return;
    }

    const saveButton = getElement("saveProductButton");

    setLoading(saveButton, true, "Save Product");

    try {
        let imageUrl = "";

        if (editingProductId) {
            const oldProduct = currentProducts.find(
                item => item.id === editingProductId
            );

            imageUrl = oldProduct?.image_url || "";
        }

        if (selectedImageFile) {
            imageUrl = await uploadProductImage(selectedImageFile);
        }

        const productData = {
            name,
            price,
            category,
            description,
            image_url: imageUrl,
            is_available: isAvailable,
            updated_at: new Date().toISOString()
        };

        let result;

        if (editingProductId) {
            result = await supabaseClient
                .from("products")
                .update(productData)
                .eq("id", editingProductId);
        } else {
            result = await supabaseClient
                .from("products")
                .insert([productData]);
        }

        if (result.error) throw result.error;

        showMessage(
            productMessage,
            editingProductId
                ? "Product Updated Successfully!"
                : "Product Added Successfully!",
            "success"
        );

        resetProductForm();

        await loadProducts();

    } catch (error) {
        console.error(error);

        showMessage(
            productMessage,
            "Error: " + error.message
        );

    } finally {
        setLoading(saveButton, false, "Save Product");
    }
});

// =====================================================
// 14. EDIT PRODUCT
// =====================================================

function editProduct(productId) {
    const product = currentProducts.find(
        item => item.id === productId
    );

    if (!product) return;

    editingProductId = productId;

    getElement("productFormContainer")
        ?.classList.remove("hidden");

    getElement("productName").value = product.name;
    getElement("productPrice").value = product.price;
    getElement("productCategory").value = product.category;

    getElement("productDescription").value =
        product.description || "";

    getElement("productStock").value =
        product.is_available ? "true" : "false";

    if (product.image_url) {
        setImagePreview(product.image_url);
    } else {
        clearImagePreview();
    }

    const saveButton = getElement("saveProductButton");

    if (saveButton) {
        saveButton.textContent = "Update Product";
    }

    const formTitle = getElement("productFormTitle");

    if (formTitle) {
        formTitle.textContent = "Edit Product";
    }

    openPage("products");

    getElement("productFormContainer")?.scrollIntoView({
        behavior: "smooth"
    });
}

// =====================================================
// 15. DELETE PRODUCT
// =====================================================

async function deleteProduct(productId) {
    const confirmed = confirm(
        "क्या आप इस Product को Delete करना चाहते हैं?"
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", productId);

    if (error) {
        alert("Delete Failed: " + error.message);
        return;
    }

    alert("Product Successfully Deleted!");

    await loadProducts();
}

// =====================================================
// 16. STOCK MANAGEMENT
// =====================================================

async function toggleStock(productId, currentStatus) {
    const newStatus = !currentStatus;

    const { error } = await supabaseClient
        .from("products")
        .update({
            is_available: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", productId);

    if (error) {
        alert("Stock Update Failed: " + error.message);
        return;
    }

    await loadProducts();
}

// =====================================================
// 17. RESET PRODUCT FORM
// =====================================================

function resetProductForm() {
    editingProductId = null;
    selectedImageFile = null;

    productForm?.reset();

    clearImagePreview();

    const saveButton = getElement("saveProductButton");

    if (saveButton) {
        saveButton.textContent = "Save Product";
    }

    const formTitle = getElement("productFormTitle");

    if (formTitle) {
        formTitle.textContent = "Add New Product";
    }

    showMessage(productMessage, "");
}

getElement("cancelProductButton")?.addEventListener("click", () => {
    resetProductForm();

    getElement("productFormContainer")
        ?.classList.add("hidden");
});

// =====================================================
// 18. PRODUCT SEARCH
// =====================================================

productSearch?.addEventListener("input", () => {
    const search = productSearch.value.toLowerCase().trim();

    const filteredProducts = currentProducts.filter(product => {
        return (
            (product.name || "").toLowerCase().includes(search) ||
            (product.category || "").toLowerCase().includes(search)
        );
    });

    renderProducts(filteredProducts);
});

// =====================================================
// 19. DASHBOARD STATISTICS
// =====================================================

function updateDashboardStats() {
    const total = currentProducts.length;

    const available = currentProducts.filter(
        product => product.is_available
    ).length;

    const outOfStock = total - available;

    if (getElement("totalProducts")) {
        getElement("totalProducts").textContent = total;
    }

    if (getElement("availableProducts")) {
        getElement("availableProducts").textContent = available;
    }

    if (getElement("outOfStockProducts")) {
        getElement("outOfStockProducts").textContent = outOfStock;
    }

    if (getElement("totalOrders")) {
        getElement("totalOrders").textContent = currentOrders.length;
    }
}

// =====================================================
// 20. ORDERS CONTAINER
// =====================================================

function getOrdersContainer() {
    const ordersPage = getElement("ordersPage");

    if (!ordersPage) return null;

    let container = getElement("ordersContent");

    if (!container) {
        container = document.createElement("div");

        container.id = "ordersContent";
        container.style.marginTop = "20px";

        ordersPage.appendChild(container);
    }

    return container;
}

// =====================================================
// 21. LOAD ORDERS
// =====================================================

async function loadOrders() {
    const container = getOrdersContainer();

    if (container) {
        container.textContent = "Loading Customer Orders...";
    }

    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Orders Loading Error:", error);

        if (container) {
            container.textContent =
                "Orders Load Failed: " + error.message;
        }

        return;
    }

    currentOrders = data || [];

    renderOrders();

    updateDashboardStats();
}

// =====================================================
// 22. RENDER ORDERS
// =====================================================

function renderOrders() {
    const container = getOrdersContainer();

    if (!container) return;

    container.innerHTML = "";

    const header = document.createElement("div");

    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.flexWrap = "wrap";
    header.style.gap = "12px";
    header.style.marginBottom = "20px";

    const heading = document.createElement("h2");
    heading.textContent = "Customer Orders";

    const refreshButton = document.createElement("button");
    refreshButton.textContent = "Refresh Orders";

    refreshButton.addEventListener("click", loadOrders);

    header.append(heading, refreshButton);

    container.appendChild(header);

    if (currentOrders.length === 0) {
        const empty = document.createElement("p");

        empty.textContent = "अभी तक कोई Order नहीं आया है।";

        empty.style.padding = "20px";

        container.appendChild(empty);
        return;
    }

    const count = document.createElement("p");

    count.textContent =
        "Total Orders: " + currentOrders.length;

    count.style.marginBottom = "15px";

    container.appendChild(count);

    currentOrders.forEach(order => {
        const card = document.createElement("div");

        card.style.border = "1px solid #444";
        card.style.borderRadius = "12px";
        card.style.padding = "18px";
        card.style.marginBottom = "18px";
        card.style.background = "#171717";

        const title = document.createElement("h3");

        title.textContent = "Order #" + order.id;
        title.style.marginBottom = "10px";

        card.appendChild(title);

        const customer = document.createElement("p");

        customer.textContent =
            "Customer: " + order.customer_name;

        card.appendChild(customer);

        const phone = document.createElement("p");

        phone.textContent =
            "Mobile: " + order.customer_phone;

        card.appendChild(phone);

        const callLink = document.createElement("a");

        callLink.href = "tel:" + order.customer_phone;
        callLink.textContent = "Call Customer";

        callLink.style.display = "inline-block";
        callLink.style.margin = "8px 0";
        callLink.style.color = "#a6d65e";

        card.appendChild(callLink);

        const type = document.createElement("p");

        type.textContent =
            "Order Type: " + order.order_type;

        card.appendChild(type);

        if (order.delivery_address) {
            const address = document.createElement("p");

            address.textContent =
                "Address: " + order.delivery_address;

            card.appendChild(address);
        }

        const itemsHeading = document.createElement("h4");

        itemsHeading.textContent = "Order Items";
        itemsHeading.style.marginTop = "12px";

        card.appendChild(itemsHeading);

        const itemsList = document.createElement("ul");

        const items = Array.isArray(order.items)
            ? order.items
            : [];

        items.forEach(item => {
            const listItem = document.createElement("li");

            listItem.textContent =
                item.name +
                " × " + item.quantity +
                " — " +
                formatPrice(item.price * item.quantity);

            itemsList.appendChild(listItem);
        });

        card.appendChild(itemsList);

        const total = document.createElement("h3");

        total.textContent =
            "Total: " + formatPrice(order.total);

        total.style.marginTop = "12px";

        card.appendChild(total);

        const payment = document.createElement("p");

        payment.textContent =
            "Payment: " + order.payment_method;

        card.appendChild(payment);

        if (order.instructions) {
            const instructions = document.createElement("p");

            instructions.textContent =
                "Instructions: " + order.instructions;

            card.appendChild(instructions);
        }

        const date = document.createElement("p");

        date.textContent =
            "Order Date: " + formatDate(order.created_at);

        card.appendChild(date);

        const statusWrapper = document.createElement("div");

        statusWrapper.style.marginTop = "15px";

        const statusLabel = document.createElement("label");

        statusLabel.textContent = "Order Status: ";
        statusLabel.style.marginRight = "10px";

        const statusSelect = document.createElement("select");

        statusSelect.style.padding = "8px";
        statusSelect.style.borderRadius = "6px";

        const currentStatus = ORDER_STATUSES.includes(order.status)
            ? order.status
            : "pending";

        ORDER_STATUSES.forEach(status => {
            const option = document.createElement("option");

            option.value = status;

            option.textContent =
                status.charAt(0).toUpperCase() + status.slice(1);

            option.selected = currentStatus === status;

            statusSelect.appendChild(option);
        });

        statusSelect.addEventListener("change", async () => {
            await updateOrderStatus(
                order.id,
                statusSelect.value,
                statusSelect
            );
        });

        statusWrapper.append(statusLabel, statusSelect);

        card.appendChild(statusWrapper);

        container.appendChild(card);
    });
}

// =====================================================
// 23. UPDATE ORDER STATUS
// =====================================================

async function updateOrderStatus(
    orderId,
    newStatus,
    selectElement
) {
    if (!ORDER_STATUSES.includes(newStatus)) {
        alert("Invalid Order Status.");
        return;
    }

    const previousOrder = currentOrders.find(
        order => order.id === orderId
    );

    const previousStatus = previousOrder?.status || "pending";

    selectElement.disabled = true;

    try {
        const { error } = await supabaseClient
            .from("orders")
            .update({
                status: newStatus
            })
            .eq("id", orderId);

        if (error) throw error;

        if (previousOrder) {
            previousOrder.status = newStatus;
        }

        alert(
            "Order #" + orderId +
            " Status Updated: " + newStatus
        );

    } catch (error) {
        console.error("Status Update Error:", error);

        alert("Status Update Failed: " + error.message);

        selectElement.value = previousStatus;

    } finally {
        selectElement.disabled = false;
    }
}

// =====================================================
// 24. NOTIFICATION PERMISSION
// =====================================================

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("Browser Notifications are not supported.");
        return;
    }

    if (Notification.permission === "default") {
        try {
            await Notification.requestPermission();
        } catch (error) {
            console.log("Notification Permission Error:", error);
        }
    }
}

// =====================================================
// 25. SOUND NOTIFICATION
// =====================================================

async function playOrderSound() {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioContext) {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();

        const gain = audioContext.createGain();

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.type = "sine";

        oscillator.frequency.setValueAtTime(
            880,
            audioContext.currentTime
        );

        gain.gain.setValueAtTime(
            0.25,
            audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.7
        );

        oscillator.start();

        oscillator.stop(audioContext.currentTime + 0.7);

    } catch (error) {
        console.log("Sound Notification Error:", error);
    }
}

// =====================================================
// 26. POPUP + BROWSER NOTIFICATION
// =====================================================

function showNewOrderNotification(order) {
    playOrderSound();

    // Dashboard Popup
    const popup = document.createElement("div");

    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.right = "20px";
    popup.style.zIndex = "99999";
    popup.style.maxWidth = "340px";
    popup.style.padding = "20px";
    popup.style.background = "#163d27";
    popup.style.color = "#ffffff";
    popup.style.border = "1px solid #a6d65e";
    popup.style.borderRadius = "12px";
    popup.style.boxShadow = "0 5px 25px rgba(0,0,0,0.4)";

    const title = document.createElement("h3");

    title.textContent = "New Order Received!";

    const details = document.createElement("p");

    details.textContent =
        "Order #" + order.id +
        " | " + order.customer_name +
        " | " + formatPrice(order.total);

    details.style.margin = "10px 0";

    const viewButton = document.createElement("button");

    viewButton.textContent = "View Order";

    viewButton.addEventListener("click", () => {
        openPage("orders");
        popup.remove();
    });

    const closeButton = document.createElement("button");

    closeButton.textContent = "Close";

    closeButton.style.marginLeft = "8px";

    closeButton.addEventListener("click", () => {
        popup.remove();
    });

    popup.append(
        title,
        details,
        viewButton,
        closeButton
    );

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 15000);

    // Browser / Mobile Notification
    if (
        "Notification" in window &&
        Notification.permission === "granted"
    ) {
        try {
            const notification = new Notification(
                "GREEN CHILLI - New Order!",
                {
                    body:
                        "Order #" + order.id +
                        " | " + order.customer_name +
                        " | " + formatPrice(order.total),

                    icon: "https://cdn-icons-png.flaticon.com/512/3075/3075977.png"
                }
            );

            notification.onclick = () => {
                window.focus();

                openPage("orders");

                notification.close();
            };

        } catch (error) {
            console.log("Browser Notification Error:", error);
        }
    }
}

// =====================================================
// 27. REALTIME ORDER LISTENER
// =====================================================

function startOrderRealtime() {
    if (orderRealtimeChannel) {
        return;
    }

    orderRealtimeChannel = supabaseClient
        .channel("green-chilli-live-orders")

        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "orders"
            },
            payload => {
                const newOrder = payload.new;

                if (!newOrder || !newOrder.id) return;

                // Prevent Duplicate Notifications
                if (knownOrderIds.has(newOrder.id)) return;

                knownOrderIds.add(newOrder.id);

                currentOrders.unshift(newOrder);

                updateDashboardStats();

                renderOrders();

                showNewOrderNotification(newOrder);
            }
        )

        .subscribe(status => {
            console.log("Order Realtime Status:", status);

            if (status === "CHANNEL_ERROR") {
                console.error(
                    "Realtime connection failed."
                );
            }
        });
}

// =====================================================
// 28. STOP REALTIME
// =====================================================

function stopOrderRealtime() {
    if (!orderRealtimeChannel) return;

    supabaseClient.removeChannel(orderRealtimeChannel);

    orderRealtimeChannel = null;
}

// =====================================================
// 29. INITIALIZE NOTIFICATIONS
// =====================================================

async function initializeOrderNotifications() {
    if (notificationsInitialized) return;

    await requestNotificationPermission();

    // Load existing orders first.
    // Old orders will not trigger notifications.
    await loadOrders();

    knownOrderIds = new Set(
        currentOrders.map(order => order.id)
    );

    startOrderRealtime();

    notificationsInitialized = true;
}

// =====================================================
// 30. AUTH STATE LISTENER
// =====================================================

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        stopOrderRealtime();

        currentProducts = [];
        currentOrders = [];

        knownOrderIds.clear();

        notificationsInitialized = false;

        showLogin();
    }
});

// =====================================================
// 31. START ADMIN DASHBOARD
// =====================================================

checkAdminSession();
