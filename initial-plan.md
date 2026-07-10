# Initial Plan

## Goals

Creata an aplication that allows users to manage their farms.
Register cattle, number of animals, age, weight, children, vacined information, medicine, and more useful information about the animals.
Also allow users to add and remove animals from the farm, soft delete animals, and add notes to animals.

This application is meant to be a web applicaction initially, but it can be converted to a mobile application later or desktop application later. So it is important to have a good design that is responsive and separete business logic from the view.

## Tech Stack

* Backend: Go (Golang) with Gin, PostgreSQL, JWT for authentication, and GORM for database management
* Frontend: React with Vite, Tailwind CSS, react-router-dom, nuqs for state management and react-hook-form for form management, typescript is mandatory, and i18n for translations, and axios for http requests, shadcn for ui components, lucide react for icons, motion for animations and transitions
* Database: PostgreSQL

I believe that the ideal for the project is to handle multi tenancy, so that each user can have their own farms, animals, and notes but not sure if the best in the beggining

But i'm open to other tech stacks if they are better suited for this project. All ears are welcome.

## Security

I'm not sure if the best way to handle security is to use JWT or to use a session. I think that the best way is to use JWT, but i'm open to other suggestions.

Also handle all the possible security issues that can happen, like SQL injection, XSS, CSRF, etc. and leave all documented in the code.

## Features

* Register farms
* Register animals
* Manage animals
* Manage farms
* Manage notes
* Roles and permissions management
  * Admin (can manage all the farms, animals, notes, and users)
  * Manager (can manage all the farms he owns, animals, notes, and users)
  * User (permission to manage his own farms, animals, notes, and users)
* Multi tenancy (to be decided)
* Multi language (use something like i18n to handle all the translations, in the beginning i will use english but being open to other languages)
* Subscriptions to improve functionalities (to be decided)
  * like notifications, etc. also to be decided, initially free tier

Also need suggestions for the deployment process, taking in count the tech stack chosen. Cost related. 

## Important

All the code must be documented, and all the documentation must be in English.
All the docmentation for ai tools, agents and others should be in English and has to be ai-agnostic to tool we are using to develop the application. As well the agents, skills, and mcps if the case requires it.

## References

- https://gansoft.io/