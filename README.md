
MyPadiMan Project

MyPadiMan is an on-demand service platform connecting users with runners for errands. The platform allows users to request services, and runners to accept and complete these tasks.


Project Overview

The MyPadiMan platform includes the following key features:

1. **User Registration and Authentication**
- Users can register as regular users or runners
- Secure authentication using JWT tokens
- User profiles with personal information

2. **Service Request System**
- Users can request services with detailed descriptions
- Geolocation-based runner search
- Price calculation based on distance

3. **Runner Management**
- Runners can set their availability status
- Real-time location tracking
- Task acceptance and completion workflow

4. **Payment Processing**
- Secure payment handling
- Wallet system for both users and runners
- Automatic payment to runners upon task completion

5. **Rating and Review System**
- Users can rate runners after service completion
- Runners build reputation through ratings and completed tasks


Technical Implementation

Backend
• **Node.js** with Express framework
• **MongoDB** database with Mongoose ODM
• **JWT** for authentication
• **Geospatial queries** for location-based runner search
• **RESTful API** design


Frontend
• **HTML/CSS/JavaScript** for the user interface
• **EJS** templating engine for server-side rendering
• **Responsive design** for mobile and desktop
• **Geolocation API** for location services


Project Structure




Key Features Implemented
1. **Geolocation-based Service Requests**
- Users can request services based on their current location
- The system finds the nearest available runners
- Distance calculation between user, runner, and destination

2. **Dynamic Pricing**
- Price calculation based on distance between user and runner
- Additional cost based on distance to destination
- Service fee added to the base price

3. **Runner Workflow**
- Runners can toggle their availability
- Accept service requests
- Track progress through the service lifecycle
- Mark tasks as completed

4. **Wallet System**
- Users can add funds to their wallet
- Pay for services using wallet balance
- Runners receive payment upon task completion


Demo Pages
1. **Home Page (index.html)**
- Introduction to the platform
- Call-to-action buttons for users and runners

2. **Runner Dashboard (runner-dashboard.html)**
- Runner statistics
- Current location tracking
- Nearby service requests
- Current task management

3. **Request Service Page (request-service.html)**
- Service request form
- Location selection
- Price estimation
- Runner selection


Future Enhancements
1. **Real-time Notifications**
- Push notifications for service updates
- Real-time chat between users and runners

2. **Advanced Payment Options**
- Integration with multiple payment gateways
- Subscription plans for frequent users

3. **Service Categories**
- Specialized runner categories
- Different pricing for different service types

4. **Analytics Dashboard**
- User activity tracking
- Runner performance metrics
- Business intelligence reports

5. **Mobile Applications**
- Native mobile apps for iOS and Android
- Offline functionality
- Enhanced location services


Conclusion

The MyPadiMan platform provides a comprehensive solution for connecting users who need errands done with runners who can perform these tasks. The geolocation-based matching system ensures efficient service delivery, while the integrated payment system provides security for both users and runners.
