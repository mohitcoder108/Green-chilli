
/* =========================================
   GREEN CHILLI - CUSTOMER WEBSITE
   Supabase + WhatsApp Ordering System
========================================= */

// =========================================
// CONFIGURATION
// =========================================

const WHATSAPP_NUMBER = "919835047077";

let allProducts = [];
let cart = [];
let selectedCategory = "All";

// =========================================
// HTML ELEMENTS
// =========================================

const foodGrid = document.getElementById("foodGrid");
const categoryList = document.getElementById("categoryList");
const searchInput = document.getElementById("searchInput");

const cartButton = document.getElementById("cartButton");
const closeCart = document.getElementById("closeCart");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");

const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");

const checkoutButton = document.getElementById("checkoutButton");
const checkoutModal = document.getElementById("checkoutModal");
const closeCheckout = document.getElementById("closeCheckout");
const checkoutForm = document.getElementById("checkoutForm");

const deliveryType = document.getElementById("deliveryType");
const customerAddress = document.getElementById("customerAddress");

// =========================================
// HELPER FUNCTIONS
// =========================================

function formatPrice(price) {
    return "₹" + Number(price).toLocaleString("en-IN");
}

function showFoodMessage(message) {
    if (!foodGrid) return;

    foodGrid.innerHTML = "";

    const paragraph = document.createElement("p");
    paragraph.textContent = message;

    foodGrid.appendChild(paragraph);
}

// =========================================
// LOAD PRODUCTS FROM SUPABASE
// =========================================

async function loadProducts() {
    showFoodMessage("Loading delicious food...");

    try {
        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;

        allProducts = data || [];

        renderCategories();
        renderProducts();

    } catch (error) {
        console.error("Product Loading Error:", error);

        showFoodMessage(
            "Menu अभी Load नहीं हो पाया। कृपया Refresh करें।"
        );
    }
}

// =========================================
// RENDER CATEGORIES
// =========================================

function renderCategories() {
    if (!categoryList) return;

    categoryList.innerHTML = "";

    const categories = [
        "All",
        ...new Set(
            allProducts
                .map(product => product.category)
                .filter(Boolean)
        )
    ];

    categories.forEach(category => {
        const button = document.createElement("button");

        button.className = "category-item";

        if (category === selectedCategory) {
            button.classList.add("active");
        }

        button.textContent =
            category === "All" ? "🍽️ All" : category;

        button.dataset.category = category;

        button.addEventListener("click", () => {
            selectedCategory = category;
            renderCategories();
            renderProducts();
        });

        categoryList.appendChild(button);
    });
}

// =========================================
// RENDER PRODUCTS
// =========================================

function renderProducts() {
    if (!foodGrid) return;

    foodGrid.innerHTML = "";

    const searchTerm =
        searchInput?.value.toLowerCase().trim() || "";

    const filteredProducts = allProducts.filter(product => {

        const matchesCategory =
            selectedCategory === "All" ||
            product.category === selectedCategory;

        const matchesSearch =
            (product.name || "").toLowerCase().includes(searchTerm) ||
            (product.description || "").toLowerCase().includes(searchTerm);

        return matchesCategory && matchesSearch;
    });

    if (filteredProducts.length === 0) {
        showFoodMessage(
            "इस Category में अभी कोई Product उपलब्ध नहीं है।"
        );
        return;
    }

    filteredProducts.forEach(product => {

        const card = document.createElement("div");
        card.className = "food-card";

        // IMAGE
        const imageContainer = document.createElement("div");
        imageContainer.className = "food-image";

        const image = document.createElement("img");
        image.src = product.image_url || "";
        image.alt = product.name || "Food";
        image.loading = "lazy";

        image.onerror = () => {
            image.style.display = "none";
        };

        imageContainer.appendChild(image);

        // STOCK LABEL
        if (!product.is_available) {

            const stockLabel = document.createElement("span");

            stockLabel.textContent = "OUT OF STOCK";
            stockLabel.className = "out-of-stock-label";

            imageContainer.appendChild(stockLabel);
        }

        // PRODUCT DETAILS
        const details = document.createElement("div");
        details.className = "food-details";

        const name = document.createElement("h3");
        name.textContent = product.name;

        const description = document.createElement("p");
        description.textContent = product.description || "";

        details.append(name, description);

        // PRICE AND BUTTON
        const bottom = document.createElement("div");
        bottom.className = "food-bottom";

        const price = document.createElement("strong");
        price.textContent = formatPrice(product.price);

        const addButton = document.createElement("button");
        addButton.className = "add-cart";

        if (product.is_available) {

            addButton.textContent = "Add to Cart +";

            addButton.addEventListener("click", () => {
                addToCart(product.id);
            });

        } else {

            addButton.textContent = "Out of Stock";
            addButton.disabled = true;
            addButton.classList.add("disabled");
        }

        bottom.append(price, addButton);
        details.appendChild(bottom);

        card.append(imageContainer, details);
        foodGrid.appendChild(card);
    });
}

// =========================================
// SEARCH PRODUCTS
// =========================================

searchInput?.addEventListener("input", renderProducts);

// =========================================
// ADD TO CART
// =========================================

function addToCart(productId) {

    const product = allProducts.find(
        item => item.id === productId
    );

    if (!product || !product.is_available) {

        alert("यह Product अभी उपलब्ध नहीं है।");
        return;
    }

    const existingItem = cart.find(
        item => item.id === productId
    );

    if (existingItem) {

        existingItem.quantity++;

    } else {

        cart.push({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image: product.image_url,
            quantity: 1
        });
    }

    updateCart();
    openCart();
}

// =========================================
// UPDATE CART
// =========================================

function updateCart() {

    if (!cartItems) return;

    cartItems.innerHTML = "";

    let totalQuantity = 0;
    let totalAmount = 0;

    if (cart.length === 0) {

        const emptyMessage = document.createElement("p");

        emptyMessage.className = "empty-cart";
        emptyMessage.textContent = "Your cart is empty.";

        cartItems.appendChild(emptyMessage);
    }

    cart.forEach(item => {

        totalQuantity += item.quantity;
        totalAmount += item.price * item.quantity;

        const cartItem = document.createElement("div");
        cartItem.className = "cart-item";

        const image = document.createElement("img");
        image.src = item.image || "";
        image.alt = item.name;

        const info = document.createElement("div");
        info.className = "cart-item-info";

        const name = document.createElement("h4");
        name.textContent = item.name;

        const price = document.createElement("p");
        price.textContent = formatPrice(item.price);

        const quantityControls = document.createElement("div");
        quantityControls.className = "quantity-controls";

        const minusButton = document.createElement("button");
        minusButton.textContent = "-";

        minusButton.addEventListener("click", () => {
            changeQuantity(item.id, -1);
        });

        const quantity = document.createElement("span");
        quantity.textContent = item.quantity;

        const plusButton = document.createElement("button");
        plusButton.textContent = "+";

        plusButton.addEventListener("click", () => {
            changeQuantity(item.id, 1);
        });

        quantityControls.append(
            minusButton,
            quantity,
            plusButton
        );

        info.append(name, price, quantityControls);
        cartItem.append(image, info);

        cartItems.appendChild(cartItem);
    });

    if (cartCount) {
        cartCount.textContent = totalQuantity;
    }

    if (cartTotal) {
        cartTotal.textContent = formatPrice(totalAmount);
    }

    if (checkoutButton) {
        checkoutButton.disabled = cart.length === 0;
    }
}

// =========================================
// CHANGE QUANTITY
// =========================================

function changeQuantity(productId, change) {

    const item = cart.find(
        product => product.id === productId
    );

    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {

        cart = cart.filter(
            product => product.id !== productId
        );
    }

    updateCart();
}

// =========================================
// OPEN / CLOSE CART
// =========================================

function openCart() {
    cartDrawer?.classList.add("active");
    cartOverlay?.classList.add("active");
}

function closeCartDrawer() {
    cartDrawer?.classList.remove("active");
    cartOverlay?.classList.remove("active");
}

cartButton?.addEventListener("click", openCart);

closeCart?.addEventListener(
    "click",
    closeCartDrawer
);

cartOverlay?.addEventListener(
    "click",
    closeCartDrawer
);

// =========================================
// CHECKOUT MODAL
// =========================================

function openCheckoutModal() {

    if (cart.length === 0) return;

    closeCartDrawer();
    checkoutModal?.classList.add("active");
}

function closeCheckoutModal() {
    checkoutModal?.classList.remove("active");
}

checkoutButton?.addEventListener(
    "click",
    openCheckoutModal
);

closeCheckout?.addEventListener(
    "click",
    closeCheckoutModal
);

// =========================================
// DELIVERY ADDRESS VALIDATION
// =========================================

function updateAddressRequirement() {

    if (!deliveryType || !customerAddress) return;

    const isDelivery =
        deliveryType.value === "Delivery";

    customerAddress.required = isDelivery;
    customerAddress.disabled = !isDelivery;

    if (!isDelivery) {
        customerAddress.value = "";
    }
}

deliveryType?.addEventListener(
    "change",
    updateAddressRequirement
);

updateAddressRequirement();

// =========================================
// VERIFY STOCK BEFORE ORDER
// =========================================

async function verifyCartStock() {

    const { data, error } = await supabaseClient
        .from("products")
        .select("id, name, price, is_available")
        .in("id", cart.map(item => item.id));

    if (error) throw error;

    for (const item of cart) {

        const latestProduct = data.find(
            product => product.id === item.id
        );

        if (!latestProduct || !latestProduct.is_available) {

            throw new Error(
                item.name + " अब उपलब्ध नहीं है।"
            );
        }

        if (Number(latestProduct.price) !== item.price) {

            throw new Error(
                item.name +
                " की कीमत बदल गई है। कृपया Cart अपडेट करें।"
            );
        }
    }
}

// =========================================
// PLACE ORDER - SUPABASE + WHATSAPP
// =========================================

checkoutForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (cart.length === 0) return;

    const customerName =
        document.getElementById("customerName").value.trim();

    const customerPhone =
        document.getElementById("customerPhone").value.trim();

    const orderType = deliveryType.value;

    const address = customerAddress.value.trim();

    const instructions =
        document.getElementById("orderInstructions").value.trim();

    // VALIDATE NAME
    if (!customerName) {

        alert("कृपया अपना नाम भरें।");
        return;
    }

    // VALIDATE PHONE
    if (!/^[6-9][0-9]{9}$/.test(customerPhone)) {

        alert("कृपया सही 10 Digit Mobile Number डालें।");
        return;
    }

    // VALIDATE ADDRESS
    if (orderType === "Delivery" && !address) {

        alert("कृपया Delivery Address भरें।");
        return;
    }

    const submitButton =
        checkoutForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = "Saving Your Order...";

    /*
       IMPORTANT FIX:
       WhatsApp tab is opened immediately during the
       customer's click. Mobile browsers may block a
       popup opened only after an await operation.
    */

    let whatsappWindow = window.open("about:blank", "_blank");

    try {

        // VERIFY PRODUCT STOCK AND PRICE
        await verifyCartStock();

        // CALCULATE TOTAL
        const totalAmount = cart.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        // PREPARE ORDER DATA
        const orderData = {

            customer_name: customerName,

            customer_phone: customerPhone,

            order_type: orderType,

            delivery_address:
                orderType === "Delivery" ? address : null,

            items: cart.map(item => ({

                product_id: item.id,

                name: item.name,

                price: item.price,

                quantity: item.quantity
            })),

            total: totalAmount,

            payment_method:
                "Cash on Delivery / Pay at Pickup",

            instructions: instructions || null
        };

        /*
           SAVE ORDER IN SUPABASE

           IMPORTANT:
           Do not use .select() here.

           Public customers can INSERT orders.
           They should not get permission to read
           other customers' private order details.
        */

        const { error: saveError } = await supabaseClient
            .from("orders")
            .insert([orderData]);

        if (saveError) throw saveError;

        // =====================================
        // CREATE WHATSAPP MESSAGE
        // =====================================

        let message = "";

        message += "🌶️ *NEW ORDER - GREEN CHILLI*%0A%0A";

        message += "*Customer Details*%0A";

        message +=
            "Name: " +
            encodeURIComponent(customerName) +
            "%0A";

        message +=
            "Mobile: " +
            encodeURIComponent(customerPhone) +
            "%0A";

        message +=
            "Order Type: " +
            encodeURIComponent(orderType) +
            "%0A";

        if (orderType === "Delivery") {

            message +=
                "Address: " +
                encodeURIComponent(address) +
                "%0A";
        }

        message += "%0A*Order Items*%0A";

        cart.forEach((item, index) => {

            message +=
                (index + 1) + ". " +
                encodeURIComponent(item.name) +
                " x " + item.quantity +
                " = " +
                encodeURIComponent(
                    formatPrice(item.price * item.quantity)
                ) +
                "%0A";
        });

        message +=
            "%0A*Total: " +
            encodeURIComponent(formatPrice(totalAmount)) +
            "*%0A";

        message +=
            "Payment: Cash on Delivery / Pay at Pickup%0A";

        if (instructions) {

            message +=
                "%0ASpecial Instructions: " +
                encodeURIComponent(instructions) +
                "%0A";
        }

        message +=
            "%0AThank you for choosing GREEN CHILLI!";

        // WHATSAPP URL
        const whatsappURL =
            "https://wa.me/" +
            WHATSAPP_NUMBER +
            "?text=" +
            message;

        // OPEN WHATSAPP
        if (whatsappWindow && !whatsappWindow.closed) {

            whatsappWindow.location.href = whatsappURL;

        } else {

            // Fallback if browser blocked the popup
            window.location.href = whatsappURL;
        }

        // CLEAR CART AFTER ORDER SAVED
        cart = [];

        updateCart();

        checkoutForm.reset();

        updateAddressRequirement();

        closeCheckoutModal();

        alert(
            "आपका Order Save हो गया है!\n" +
            "अब WhatsApp पर Send बटन दबाकर Order Confirm करें।"
        );

    } catch (error) {

        console.error("Order Error:", error);

        if (whatsappWindow && !whatsappWindow.closed) {
            whatsappWindow.close();
        }

        alert(
            "Order Save नहीं हो पाया। कृपया दोबारा कोशिश करें।\n\n" +
            error.message
        );

        await loadProducts();

    } finally {

        submitButton.disabled = false;

        submitButton.textContent =
            "Place Order on WhatsApp →";
    }
});

// =========================================
// INITIALIZE WEBSITE
// =========================================

updateCart();

loadProducts();
