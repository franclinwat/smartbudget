# 💰 SmartBudget API

> API REST de gestion de budget personnel — Spring Boot 3 · Spring Security JWT · Angular

[![Java](https://img.shields.io/badge/Java-17-orange?logo=java)](https://www.java.com)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-green?logo=springboot)](https://spring.io/projects/spring-boot)
[![MySQL](https://img.shields.io/badge/MySQL-8-blue?logo=mysql)](https://www.mysql.com)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 📋 Présentation

SmartBudget est une application full-stack de gestion de budget personnel permettant aux utilisateurs de :

- 📊 Suivre leurs revenus et dépenses par catégorie
- 🎯 Définir des budgets mensuels par catégorie
- 🔒 Gérer leurs données de façon sécurisée (authentification JWT)
- 📈 Visualiser leurs statistiques financières

Ce projet a été développé comme projet de portfolio couvrant les concepts clés du développement Java/Spring Boot professionnel.

---

## 🛠️ Stack technique

### Backend
| Technologie | Version | Rôle |
|---|---|---|
| Java | 17 | Langage principal |
| Spring Boot | 3.2 | Framework backend |
| Spring Security | 6.x | Authentification & autorisation |
| Spring Data JPA | 3.x | Accès base de données |
| Hibernate | 6.x | ORM |
| JJWT | 0.12.3 | Génération/validation JWT |
| MapStruct | 1.5.5 | Mapping Entity ↔ DTO |
| Log4j2 | 2.x | Logging |
| Lombok | 1.18 | Réduction du boilerplate |
| MySQL | 8.x | Base de données |
| Maven | 3.x | Gestion des dépendances |

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| Angular | 17 | Framework frontend |
| TypeScript | 5.x | Langage |
| HttpClient | - | Appels AJAX vers l'API |

---

## 🏗️ Architecture

```
com.franclin.smartbudget/
├── entity/          # Entités JPA (User, Category, Transaction, Budget)
├── repository/      # Interfaces Spring Data JPA
├── service/         # Interfaces métier
│   └── impl/        # Implémentations (logique métier)
├── controller/      # Endpoints REST
├── dto/
│   ├── request/     # Objets reçus du client (avec validation)
│   └── response/    # Objets retournés au client
├── mapper/          # Mapping MapStruct Entity ↔ DTO
├── exception/       # Gestion globale des erreurs
└── config/          # Spring Security, JWT, CORS
```

### Architecture en couches

```
Client (Angular)
      ↓  HTTP Request + JWT
Controller        → reçoit la requête, délègue au Service
      ↓
Service (interface + impl) → logique métier, Stream API
      ↓
Repository        → Spring Data JPA, requêtes BDD
      ↓
Entity/Database   → MySQL, tables indexées
```

---

## 🔐 Sécurité

- Authentification **stateless** avec **JWT** (JSON Web Token)
- **CSRF désactivé** — inutile sur une API REST avec JWT (pas de cookies)
- Mots de passe hashés avec **BCrypt**
- Contrôle d'accès par rôle avec **@PreAuthorize**
- Rôles disponibles : `ROLE_USER`, `ROLE_ADMIN`

### Flow d'authentification
```
POST /api/auth/register → crée le compte
POST /api/auth/login    → retourne un JWT token
GET  /api/transactions  → requiert Bearer token dans le header
```

---

## 📡 Endpoints API

### Authentification
| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Inscription |
| POST | `/api/auth/login` | Public | Connexion → JWT |

### Transactions
| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| GET | `/api/transactions` | USER | Mes transactions |
| POST | `/api/transactions` | USER | Créer une transaction |
| GET | `/api/transactions/{id}` | USER | Détail |
| DELETE | `/api/transactions/{id}` | USER | Supprimer |

### Budget
| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| GET | `/api/budgets` | USER | Mes budgets |
| POST | `/api/budgets` | USER | Créer un budget |
| GET | `/api/budgets/stats` | USER | Statistiques du mois |

### Administration
| Méthode | Endpoint | Accès | Description |
|---|---|---|---|
| GET | `/api/admin/users` | ADMIN | Liste tous les users |

---

## 🚀 Installation et démarrage

### Prérequis
- Java 17+
- Maven 3.6+
- MySQL 8+ (XAMPP recommandé)

### Étapes

```bash
# 1. Cloner le projet
git clone https://github.com/franclinwat/smartbudget.git
cd smartbudget

# 2. Créer la base de données MySQL
# Démarrer XAMPP → ouvrir phpMyAdmin
# Créer une base de données : smartbudget_db

# 3. Configurer les variables d'environnement
# Copier le fichier exemple
cp src/main/resources/application.example.properties \
   src/main/resources/application.properties
# Modifier avec vos paramètres MySQL

# 4. Lancer l'application
mvn spring-boot:run

# L'API est disponible sur http://localhost:8080
```

### Variables d'environnement requises
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/smartbudget_db
spring.datasource.username=YOUR_USERNAME
spring.datasource.password=YOUR_PASSWORD
jwt.secret=YOUR_SECRET_KEY_256_BITS_MINIMUM
jwt.expiration=86400000
```

---

## 🧪 Tests avec Postman

Une collection Postman est disponible dans `/postman/SmartBudget.postman_collection.json`

**Étapes de test :**
1. `POST /api/auth/register` — créer un compte
2. `POST /api/auth/login` — récupérer le token JWT
3. Ajouter le token dans le header : `Authorization: Bearer <token>`
4. Tester les endpoints protégés

---

## 📚 Concepts couverts

Ce projet illustre les concepts suivants :

- ✅ **POO** — héritage, encapsulation, interfaces, composition
- ✅ **SOLID** — SRP, DIP appliqués à l'architecture Spring
- ✅ **JPA/Hibernate** — entités, relations, indexation, FetchType
- ✅ **DTO pattern** — séparation request/response, validation
- ✅ **Stream API** — filter, map, collect dans les services
- ✅ **Interfaces fonctionnelles** — Predicate, Function dans la logique métier
- ✅ **Log4j2** — logging structuré par couche et niveau
- ✅ **Spring Security** — JWT stateless, CSRF, BCrypt
- ✅ **@PreAuthorize** — contrôle d'accès par rôle
- ✅ **Git** — workflow feature branches, merge vs rebase
- ✅ **Angular** — composants standalone, cycle de vie, HttpClient

---

## 👨‍💻 Auteur

**Franclin Watchou**
- GitHub: [@franclinwat](https://github.com/franclinwat)
- LinkedIn: [ton-lien-linkedin]

---

## 📄 Licence

Ce projet est sous licence MIT.