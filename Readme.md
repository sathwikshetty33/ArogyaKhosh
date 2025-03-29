# ArogyaKhosh 🚀

## Overview
ArogyaKhosh is a **blockchain-powered** healthcare management system that securely stores and shares **electronic health records (EHRs)** among hospitals. It integrates **AI for healthcare chatbots**, **Automatic Insurance appliance**, and a **QR-based emergency response system** to send ambulance requests in case of an accident.

---

## Features 🌟
- **🛡️ Blockchain Security:** Uses Ethereum blockchain to store and share healthcare records securely.
- **🤖 AI-Powered Chatbot:** Provides instant healthcare guidance using an AI chatbot.
- **🧬 Machine Learning for Medical Research:** Analyzes healthcare data to find protein combinations.
- **🚑 QR Code Emergency System:** Instantly scans a patient's QR code in case of an accident and alerts the nearest hospital.
- **🏥 Seamless Inter-Hospital Communication:** Securely shares patient records among authorized hospitals.
- **🖥️ Django Backend:** Manages user authentication, API endpoints, and database operations.
- **Emergency Response System**: QR code scanning triggers an ambulance request.
- **Automatic Insurance management**: Automatically applies insurance in case of accident.
---

## Technologies Used 🛠️
- **Blockchain:** Ethereum, Smart Contracts (Solidity)
- **AI Chatbot:** NLP, TensorFlow, OpenAI API
- **Machine Learning:** Python, Scikit-learn, Pandas, NumPy
- **Backend:** Django, Django REST Framework (DRF)
- **Database:** PostgreSQL
- **Web & Frontend:** React.js, Node.js, Express.js
- **QR Code System:** OpenCV, Python, Twilio API (for SMS alerts)
- **Smart Contract Deployment:** Hardhat, Web3.js

---

## Installation & Setup 🏗️
### Prerequisites
- Node.js
- Python (for Django backend , ML models & flask)
- PostgreSQL
- Metamask (for Ethereum transactions)
- Infura (for managing nodes)

### Steps
1. **Clone the repository**
   ```sh
   git clone https://github.com/sathwikshetty33/ArogyaKhosh.git
   cd ElectronicHealthRecordEtherium
   ```
2. **Install dependencies**
   ```sh
   npm install
   pip install -r requirements.txt
   ```
3. **Setup Django Backend**
   ```sh
   cd backend
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py runserver
   ```
4. **Start Blockchain Node (Ganache or Infura)**
5. **Deploy Smart Contracts**
   ```sh
   npx hardhat run scripts/deploy.js --network localhost
   ```


---

## How It Works ⚙️
1. **User Authentication**: Users and hospitals log in using Django authentication.
2. **Health Record Management**: Records are stored in smart contracts and accessed via blockchain.
3. **AI Chatbot**: Provides medical guidance based on symptoms.
4. **Machine Learning Analysis**: Analyzes Prescription and scrapes for thr cheapest product on the internet.
5. **Emergency Response System**: QR code scanning triggers an ambulance request.
6. **Automatic Insurance management**: Automatically applies insurance in case of accident.



---

## Future Enhancements 🚀
- 🔍 **Decentralized AI models** for better privacy.
- 🏥 **Hospital Network Expansion** for global collaboration.
- 📲 **Mobile App Integration** for easier access.

---

## Contributing 🤝
Feel free to **fork** this repository and contribute! 

1. Fork the project
2. Create a new branch (`feature-branch`)
3. Commit your changes
4. Open a pull request

---

## License 📜
This project is licensed under the **MIT License**.

---

## Contact 📬
- **GitHub:** https://github.com/sathwikshetty33
- **Email:** sathwikshetty9876@gmail.com
